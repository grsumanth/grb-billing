const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.argv[2];
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.argv[3];

if (!clientId || !clientSecret) {
  console.log('❌ Error: Please provide GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.');
  console.log('Usage: node oauth-helper.js <client_id> <client_secret>');
  console.log('Or configure them in your backend/.env file first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  'http://localhost:5000'
);

const scopes = [
  'https://www.googleapis.com/auth/drive'
];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline', // crucial to get a refresh token
  scope: scopes,
  prompt: 'consent'       // forces Google to return a refresh token every time
});

console.log('\n🔑 1. Open the following URL in your browser to authorize the app:');
console.log('------------------------------------------------------------------');
console.log(url);
console.log('------------------------------------------------------------------\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('🔑 2. After consenting, you will be redirected to a page that fails to load (e.g. localhost:5000/?code=...).\nCopy the "code" parameter value from that URL and paste it here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Tokens received successfully!');
    console.log('------------------------------------------------------------------');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('------------------------------------------------------------------');
    console.log('\nCopy the GOOGLE_DRIVE_REFRESH_TOKEN above and paste it in your backend/.env file.');
  } catch (error) {
    console.error('❌ Error retrieving access token:', error.message);
  }
});
