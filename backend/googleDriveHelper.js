const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const folderCache = {};

/**
 * Authenticates with Google Drive API
 * @returns {google.drive.Drive|null} drive client, or null if not configured
 */
function getDriveClient() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.CLIENT_URL || 'http://localhost:5000'
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (err) {
      console.error('❌ Failed to initialize Google Drive client via OAuth2:', err.message);
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    return null;
  }

  // Handle escape sequences in private key (e.g., if loaded from env string)
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey
      },
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return google.drive({ version: 'v3', auth });
  } catch (err) {
    console.error('❌ Failed to initialize Google Drive client:', err.message);
    return null;
  }
}

/**
 * Gets or creates a folder inside a parent folder on Google Drive
 * Uses folderCache to reduce API requests.
 */
async function getOrCreateFolder(drive, folderName, parentId = null) {
  const cacheKey = parentId ? `${parentId}/${folderName}` : folderName;
  if (folderCache[cacheKey]) {
    return folderCache[cacheKey];
  }

  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (rootFolderId) {
      query += ` and '${rootFolderId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }
  }

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  let folderId;
  if (res.data.files && res.data.files.length > 0) {
    folderId = res.data.files[0].id;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    const actualParentId = parentId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (actualParentId) {
      fileMetadata.parents = [actualParentId];
    }
    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
      supportsAllDrives: true
    });
    folderId = folder.data.id;
  }

  folderCache[cacheKey] = folderId;
  return folderId;
}

/**
 * Uploads/updates a PDF file to the appropriate folder structure on Google Drive
 * (Uses the customized WhatsApp Invoice PDF template)
 * @param {string} billId - The ID of the bill
 * @param {Buffer} pdfBuffer - Ignored here so that we always generate the custom WhatsApp layout
 */
async function uploadPDFToDrive(billId, pdfBuffer = null) {
  const drive = getDriveClient();
  if (!drive) {
    console.warn('⚠️ Google Drive credentials missing or client invalid. Skipping GDrive upload.');
    return null;
  }

  // 1. Fetch bill details from DB (joining customer details to get the phone number)
  const billResult = await pool.query(`
    SELECT b.*, c.phone AS customer_phone 
    FROM bills b 
    LEFT JOIN customers c ON b.customer_id = c.id 
    WHERE b.id = $1
  `, [billId]);

  if (!billResult.rows.length) {
    throw new Error(`Bill #${billId} not found in database.`);
  }
  const bill = billResult.rows[0];

  // 2. Fetch the items and generate the WhatsApp-specific PDF invoice template
  const itemsResult = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id', [billId]);
  const { generateWhatsAppPDF } = require('./pdfHelper');
  const buffer = await generateWhatsAppPDF(bill, itemsResult.rows);

  // 3. Resolve folder hierarchy: GRB Billing Backups -> Bills -> [Year] -> [Month]
  const now = new Date(bill.created_at || Date.now());
  const yearStr = now.getFullYear().toString();
  const monthStr = now.toLocaleString('en-US', { month: 'long' });

  const rootId = await getOrCreateFolder(drive, 'GRB Billing Backups');
  const billsId = await getOrCreateFolder(drive, 'Bills', rootId);
  const yearId = await getOrCreateFolder(drive, yearStr, billsId);
  const monthId = await getOrCreateFolder(drive, monthStr, yearId);

  const fileName = `GRB-Bill-${billId}.pdf`;

  // 4. Check if file already exists in GDrive to update or create
  let existingFileId = null;
  const listRes = await drive.files.list({
    q: `name = '${fileName}' and '${monthId}' in parents and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  if (listRes.data.files && listRes.data.files.length > 0) {
    existingFileId = listRes.data.files[0].id;
  }

  const media = {
    mimeType: 'application/pdf',
    body: require('stream').Readable.from(buffer)
  };

  let uploadRes;
  if (existingFileId) {
    uploadRes = await drive.files.update({
      fileId: existingFileId,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });
  } else {
    const fileMetadata = {
      name: fileName,
      parents: [monthId]
    };
    uploadRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });
  }

  const fileId = uploadRes.data.id;

  // 5. Set read permissions to 'anyone' so it can be accessed
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true
    });
  } catch (permErr) {
    console.warn(`⚠️ Failed to set public permissions for GDrive file ${fileId}:`, permErr.message);
  }

  // Fetch file metadata to ensure we get a webViewLink
  const fileInfo = await drive.files.get({
    fileId: fileId,
    fields: 'webViewLink, webContentLink',
    supportsAllDrives: true
  });

  const fileLink = fileInfo.data.webViewLink;

  // 6. Update database row
  await pool.query(
    `UPDATE bills SET gd_file_id = $1, gd_file_link = $2, backup_status = 'Backed Up' WHERE id = $3`,
    [fileId, fileLink, billId]
  );

  console.log(`☁️ Bill #${billId} successfully backed up to GDrive. File ID: ${fileId}`);
  return { fileId, fileLink };
}

/**
 * Background worker: finds and retries pending or failed backups
 */
async function processPendingBackups() {
  const drive = getDriveClient();
  if (!drive) {
    return; // Silent bypass if not configured
  }

  try {
    const pending = await pool.query(
      `SELECT id FROM bills WHERE backup_status IN ('Pending', 'Failed') ORDER BY created_at DESC LIMIT 5`
    );

    if (pending.rows.length > 0) {
      console.log(`🔄 GDrive Backup Worker: Found ${pending.rows.length} pending/failed bill backup(s). Processing...`);
      for (const row of pending.rows) {
        try {
          await uploadPDFToDrive(row.id);
        } catch (err) {
          console.error(`❌ GDrive Backup Worker: Failed to upload bill #${row.id}:`, err.message);
          await pool.query(`UPDATE bills SET backup_status = 'Failed' WHERE id = $1`, [row.id]);
        }
      }
    }
  } catch (err) {
    console.error('❌ GDrive Backup Worker error during pending selection:', err.message);
  }
}

/**
 * Initializes the background worker interval
 */
function initBackupWorker() {
  const hasServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY;
  const hasOAuth2 = process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!hasServiceAccount && !hasOAuth2) {
    console.warn('⚠️ Google Drive credentials missing in .env. Background GDrive backup worker is suspended.');
    return;
  }

  console.log('✅ Google Drive backup background worker initialized.');

  // Run initial sync after 10 seconds to allow DB/Server startup to fully settle
  setTimeout(() => {
    processPendingBackups().catch(err => console.error('GDrive Backup Worker initial run error:', err.message));
  }, 10000);

  // Repeat every 1 minute
  setInterval(() => {
    processPendingBackups().catch(err => console.error('GDrive Backup Worker interval error:', err.message));
  }, 60000);
}

module.exports = {
  uploadPDFToDrive,
  processPendingBackups,
  initBackupWorker,
  getDriveClient,
  uploadFullBackupToDrive,
  downloadBackupFromDrive,
  restoreBackupFromDrive
};

/**
 * Exports the entire database as a JSON payload and uploads it to Google Drive
 */
async function uploadFullBackupToDrive() {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive credentials missing or client invalid.');
  }

  // 1. Export all tables
  const bills = await pool.query('SELECT * FROM bills ORDER BY created_at ASC');
  const billItems = await pool.query('SELECT * FROM bill_items');
  const customers = await pool.query('SELECT * FROM customers ORDER BY created_at ASC');
  const products = await pool.query('SELECT * FROM products ORDER BY created_at ASC');
  const balanceHistory = await pool.query('SELECT * FROM balance_history ORDER BY changed_at ASC');

  const backupPayload = {
    bills: bills.rows,
    bill_items: billItems.rows,
    customers: customers.rows,
    products: products.rows,
    balance_history: balanceHistory.rows,
    exported_at: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const buffer = Buffer.from(jsonStr, 'utf8');

  // 2. Resolve database backups folder structure
  const rootId = await getOrCreateFolder(drive, 'GRB Billing Backups');
  const dbBackupsId = await getOrCreateFolder(drive, 'Database Backups', rootId);

  // 3. Formulate file name
  const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const fileName = `GRB-DB-Backup-${timestamp}.json`;

  // 4. Upload to GDrive
  const media = {
    mimeType: 'application/json',
    body: require('stream').Readable.from(buffer)
  };

  const fileMetadata = {
    name: fileName,
    parents: [dbBackupsId]
  };

  const uploadRes = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true
  });

  console.log(`☁️ Database successfully backed up to GDrive: ${fileName}`);
  return uploadRes.data;
}

/**
 * Lists all JSON backups stored in the GDrive "Database Backups" folder
 */
async function downloadBackupFromDrive() {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive credentials missing or client invalid.');
  }

  const rootId = await getOrCreateFolder(drive, 'GRB Billing Backups');
  const dbBackupsId = await getOrCreateFolder(drive, 'Database Backups', rootId);

  const res = await drive.files.list({
    q: `'${dbBackupsId}' in parents and name contains 'GRB-DB-Backup-' and trashed = false`,
    orderBy: 'name desc',
    fields: 'files(id, name, createdTime, size)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  return res.data.files || [];
}

/**
 * Downloads a backup file from Google Drive and returns its JSON content
 */
async function restoreBackupFromDrive(fileId) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive credentials missing or client invalid.');
  }

  const res = await drive.files.get(
    { fileId: fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'json' }
  );

  return res.data;
}
