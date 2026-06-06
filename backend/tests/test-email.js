const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

console.log('Testing SMTP connection with:');
console.log('GMAIL_USER:', process.env.GMAIL_USER);
console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? '********' : 'NOT CONFIGURED');

transporter.verify((err, success) => {
  if (err) {
    console.error('❌ SMTP Connection Verification Failed:');
    console.error(err);
  } else {
    console.log('✅ SMTP Connection is ready and verified successfully!');
  }
  process.exit(err ? 1 : 0);
});
