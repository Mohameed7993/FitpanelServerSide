// admin.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const Authentication = admin.auth();
const dtabase = admin.firestore();
const storage_admin = admin.storage();

module.exports = { Authentication, dtabase, storage_admin };
