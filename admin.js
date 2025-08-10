// admin.js
const admin = require('firebase-admin');
const { buffer } = require('stream/consumers');
require('dotenv').config();

const serviceAccount = JSON.parse(
//  Buffer.from("", 'base64').toString('utf-8')
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const Authentication = admin.auth();
const dtabase = admin.firestore();
const storage_admin = admin.storage();

module.exports = { Authentication, dtabase, storage_admin };
