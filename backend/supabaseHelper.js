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
