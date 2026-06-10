const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Use service role key if available (recommended on backend to bypass RLS), else fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
} else {
  console.warn('⚠️ Supabase credentials missing. Supabase Storage upload is disabled.');
}

// Track whether we've already ensured the bucket exists
let bucketReady = false;

/**
 * Ensures the 'bills' storage bucket exists, creating it if needed.
 * Only runs once per process lifetime.
 */
async function ensureBucket() {
  if (bucketReady || !supabase) return;

  try {
    const { error } = await supabase.storage.getBucket('bills');
    if (error && error.message && error.message.includes('not found')) {
      // Bucket doesn't exist — create it as a public bucket
      const { error: createErr } = await supabase.storage.createBucket('bills', {
        public: true,
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 5 * 1024 * 1024 // 5 MB
      });
      if (createErr) {
        console.error('❌ Failed to create "bills" storage bucket:', createErr.message);
        console.error('   ℹ️  Bucket auto-creation requires SUPABASE_SERVICE_ROLE_KEY (not the anon key).');
        console.error('   ℹ️  Alternatively, create the "bills" bucket manually in Supabase Dashboard → Storage.');
        return; // Don't set bucketReady so it retries next time
      }
      console.log('✅ Created Supabase storage bucket: bills');
    } else if (error) {
      console.error('⚠️ Error checking storage bucket:', error.message);
      return;
    }
    bucketReady = true;
  } catch (err) {
    console.error('⚠️ Bucket init error:', err.message);
  }
}

/**
 * Uploads a bill PDF buffer to Supabase Storage in the "bills" bucket
 * @param {string} billId - The ID of the bill
 * @param {Buffer} pdfBuffer - The generated PDF buffer
 * @returns {Promise<string|null>} - The public URL of the uploaded PDF, or null if failed
 */
async function uploadPDF(billId, pdfBuffer) {
  if (!supabase) {
    console.warn('⚠️ Supabase not configured. Skipping upload.');
    return null;
  }

  const fileName = `GRB-Bill-${billId}.pdf`;

  try {
    // Ensure the bucket exists before uploading
    await ensureBucket();

    // Attempt to upload PDF
    const { error } = await supabase.storage
      .from('bills')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('bills')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (err) {
    console.error('❌ Supabase storage upload error:', err.message);
    return null; // Return null so the main flow can continue with a warning
  }
}

module.exports = { uploadPDF, supabase };
