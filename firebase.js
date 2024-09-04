

//firebase.js
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');
const { getStorage} =require ("firebase/storage");



const firebaseConfig = {
  apiKey: "AIzaSyDoP3TLJcVPRKnbR0r7AaFMmR_g1GYvhSk",
  authDomain: "booming-voice-396809.firebaseapp.com",
  projectId: "booming-voice-396809",
  storageBucket: "booming-voice-396809.appspot.com",
  messagingSenderId:"931554022095",
  appId:"1:931554022095:web:531dd5ad83bb484a1b1dba",
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Authentication
const auth = getAuth(app);

const storage=getStorage(app);


module.exports = { db, auth,storage };
