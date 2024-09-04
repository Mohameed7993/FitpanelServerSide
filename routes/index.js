const express = require('express');
const router = express.Router();
const { getDocs,setDoc,collection,runTransaction,getDoc, Timestamp,updateDoc,query,doc, where } = require('firebase/firestore');
const { signInWithEmailAndPassword,createUserWithEmailAndPassword } = require('firebase/auth'); // Import Firebase Authentication functions
const { db, auth,storage } = require('../firebase'); // Import Firestore and Auth instances
const { getDownloadURL, uploadBytes, ref } = require('firebase/storage');
const multer = require('multer');
const path = require('path');


// Route to fetch all users
router.get('/Users', async (req, res) => {
  try {
    // Fetch all users from the 'Users' collection
    const usersSnapshot = await getDocs(collection(db, 'Users'));
    if (usersSnapshot.empty) {
      return res.status(404).send('No users found');
    }

    // Map through documents and format the response
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Send the users data as a JSON response
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});
// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  });
 
  
  router.get('/customers', async (req, res) => {
    const { trainerID } = req.query;
  
    if (!trainerID) {
      return res.status(400).json({ message: 'Trainer ID is required.' });
    }
  
    try {
      const customersCollection = collection(db, 'customers');
      const customersQuery = query(customersCollection, where('trainerID', '==', trainerID));
      const customerSnapshot = await getDocs(customersQuery);
  
      if (customerSnapshot.empty) {
        return res.status(404).json({ message: 'No customers found.' });
      }
  
      const customerList = customerSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      res.status(200).json({ customers: customerList });
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Internal Server Error.' });
    }
  });
  

  // Route to update user details
  router.put('/UpdateTrainerDetails', upload.single('imageFile'), async (req, res) => {
    try {
      const { userId, firstName, lastName, emailAddress, planID, expirationDate } = req.body;
      const imageFile = req.file;
      // Get current user data
      const userDocRef = doc(db, 'Users', userId);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        return res.status(404).json({ message: 'User not found' });
      }
      const currentData = userDoc.data();
  
      // Prepare updated fields
      let updates = {};
      if (firstName && firstName !== currentData.FirstName) updates.FirstName = firstName;
      if (lastName && lastName !== currentData.LastName) updates.LastName = lastName;
      if (emailAddress && emailAddress !== currentData.EmailAddress) updates.EmailAddress = emailAddress;
  
      // Check if planID has changed and set expirationDate only if it has
      if (planID && planID !== currentData.PlanID) {
        updates.PlanID = planID;
        if (expirationDate) updates.expirationDate = Timestamp.fromDate(new Date(expirationDate));
      } else if (planID) {
        updates.PlanID = planID;
      }
  
      // Upload image if it exists and is new
      if (imageFile) {
        const imageRef = ref(storage, `Users/${userId}`);
        await uploadBytes(imageRef, imageFile.buffer);
        const newImageURL = await getDownloadURL(imageRef);
        if (newImageURL !== currentData.ImageURL) updates.ImageURL = newImageURL;
      }
  
      // Update user details in Firestore only if there are changes
      if (Object.keys(updates).length > 0) {
        await updateDoc(userDocRef, updates);
      }
  
      res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal Server Error', error });
    }
  });
  
  router.post('/validateAndAddTrainer', upload.single('imageFile'), async (req, res) => {
    const { userId, firstName, lastName, emailAddress, membershipStatus, planID,description
      ,firstLoggin,location,phoneNumber,role,traineesNumber} = req.body;
    const imageFile = req.file;
  
    try {
      // Validation
      const userDocRef = doc(db, "Users", userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        return res.status(400).json({ message: 'Error, User ID is already taken..' });
      }

      const signup=await createUserWithEmailAndPassword(auth,emailAddress,userId)
      if(signup){
        let imageURL = '';
        if (imageFile) {
          const imageRef = ref(storage, `Users/${userId}`);
          await uploadBytes(imageRef, imageFile.buffer);
          imageURL = await getDownloadURL(imageRef);
        }
    
        // Adjust expirationDate
        let expirationDate = Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 14))); // Default to 2 weeks
        if (planID === '211' || planID === '241') {
          expirationDate = Timestamp.fromDate(new Date(new Date().setMonth(new Date().getMonth() + 1))); // 2 months for Elite or Premium
        }
    
        // Save trainer details
        await setDoc(userDocRef, { 
          FirstName: firstName,
          LastName: lastName,
          EmailAddress: emailAddress,
          membershipStatus: membershipStatus,
          PlanID: planID,
          ImageURL: imageURL,
          expirationDate: expirationDate ,
          Participating_from:Timestamp.now(),
          Location: location,
          PhoneNumber:phoneNumber,
          traineesNumber:Number(traineesNumber),
          Description:description,
          FirstLoggin:Number(firstLoggin),
          UserId:userId,
          role:Number(role)
        });
    
        // Increment trainersNumber in the selected plan
        const planDocRef = doc(db, "TrainersPlans", planID);
        await runTransaction(db, async (transaction) => {
          const planDoc = await transaction.get(planDocRef);
          if (!planDoc.exists()) {
            throw new Error("Plan document does not exist!");
          }
          const updatedTrainersNumber = (planDoc.data().trainersNumber || 0) + 1;
          transaction.update(planDocRef, { trainersNumber: updatedTrainersNumber });
        });
    
        res.status(200).json({ message: 'Trainer added successfully!' });
    
      }else{
        return res.status(400).json({ message: 'Error, Email is already in Use...' });
      }
    
    } catch (error) {
      res.status(500).json({ message: 'Error'+ error.code, error });
    }
  });
  



router.put('/UpdateTrainerStatus', async (req, res) => {
    const { userId, newStatus } = req.body;
  
    try {
      // Update the user's membership status in Firestore
      await updateDoc(doc(db, 'Users', userId), { membershipStatus: newStatus });
      res.status(200).json({ message: 'Membership status updated successfully' });
    } catch (error) {
      console.error('Error updating membership status:', error);
      res.status(500).json({ message: 'Internal Server Error', error });
    }
  });

router.put('/UpdateCounterAtTrainersPlan', async (req, res) => {
    const { oldPlanID, newPlanID } = req.body;
  
    try {
      const planCollection = collection(db, 'TrainersPlans');
      
      // Update old plan count if oldPlanID is provided
      if (oldPlanID) {
        const oldPlanDocRef = doc(planCollection, oldPlanID);
        const oldPlanDoc = await getDoc(oldPlanDocRef);
  
        if (oldPlanDoc.exists()) {
          const oldPlanData = oldPlanDoc.data();
          await updateDoc(oldPlanDocRef, { trainersNumber: oldPlanData.trainersNumber - 1 });
        }
      }
  
      // Update new plan count if newPlanID is provided
      if (newPlanID) {
        const newPlanDocRef = doc(planCollection, newPlanID);
        const newPlanDoc = await getDoc(newPlanDocRef);
  
        if (newPlanDoc.exists()) {
          const newPlanData = newPlanDoc.data();
          await updateDoc(newPlanDocRef, { trainersNumber: newPlanData.trainersNumber + 1 });
        }
      }
  
      res.status(200).json({ message: 'Plan counts updated successfully' });
    } catch (error) {
      console.error('Error updating plan counts:', error);
      res.status(500).json({ message: 'Internal Server Error', error });
    }
  });

// Route to handle user login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Sign in the user
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (user) {
      // Retrieve user details
      const userDetailsQuery = query(collection(db, 'Users'), where('EmailAddress', '==', email));
      const querySnapshot = await getDocs(userDetailsQuery);

      const customerDetailsQuery = query(collection(db, 'customers'), where('email', '==', email));
      const querySnapshot1 = await getDocs(customerDetailsQuery);

      let userDetails = null;
      if (!querySnapshot.empty) {
        userDetails = querySnapshot.docs[0].data();
      } else if (!querySnapshot1.empty) {
        userDetails = querySnapshot1.docs[0].data();
      }

      if (userDetails) {
        return res.status(200).json({ user, userDetails });
      } else {
        return res.status(404).json({ message: 'No user details found' });
      }
    }
  } catch (error) {
    console.error('Error signing in:', error);
    return res.status(500).json({ message: 'Error signing in', error });
  }
});

router.post('/updatepassword', async (req, res) => {
    const { uid, newPassword } = req.body;
    console.log(111)
    console.log(uid)
    try {
      // Note: This will update the password of the user with the given UID
      await auth.updateUser(uid, { password: newPassword });
      res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ message: 'Error updating password', error });
    }
  });

  router.get('/plans', async (req, res) => {
    try {
      const plansCollection = collection(db, 'TrainersPlans');
      const snapshot = await getDocs(plansCollection);
      const plans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.status(200).json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).send('Internal Server Error');
    }
  });

module.exports = router;
