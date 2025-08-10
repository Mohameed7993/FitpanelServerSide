const express = require('express');
const router = express.Router();

const { getDocs,setDoc,collection,runTransaction,getDoc, Timestamp,updateDoc,query,doc, where,deleteDoc } = require('firebase/firestore');
const { signInWithEmailAndPassword,createUserWithEmailAndPassword } = require('firebase/auth'); // Import Firebase Authentication functions
const { db, auth,storage } = require('../firebase'); // Import Firestore and Auth instances
const {Authentication, dtabase, storage_admin} = require('../admin'); // Import Admin SDK instances
const { getDownloadURL, uploadBytes, ref } = require('firebase/storage');
const multer = require('multer');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

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

 
  
  router.get('/customers', async (req, res) => {
    const { trainerID } = req.query;
  
    if (!trainerID) {
      return res.status(400).json({ message: 'Trainer ID is required.' });
    }
  
    try {
      const customersCollection = collection(db, 'customers');
      const customersQuery = query(customersCollection, where('trainerID', '==', trainerID));
      const customerSnapshot = await getDocs(customersQuery);
  
      const customerList = customerSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      // ✅ Always return 200, even if empty
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
        let expirationDate;

        const now = new Date();
        
        if (planID === '111') {
          // 1 Month Plan
          expirationDate = Timestamp.fromDate(new Date(now.setMonth(now.getMonth() + 1)));
        } else if (planID === '211') {
          // 3 Months Plan
          expirationDate = Timestamp.fromDate(new Date(now.setMonth(now.getMonth() + 3)));
        } else if (planID === '241') {
          // 6 Months Plan
          expirationDate = Timestamp.fromDate(new Date(now.setMonth(now.getMonth() + 6)));
        } else {
          // Default fallback (optional)
          expirationDate = Timestamp.fromDate(new Date(now.setDate(now.getDate() + 14))); // 2 weeks
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
          FirstLoggin:1,
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
    console.error('Error signing inuser not found');
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

  // Configure multer for file uploads


  router.post('/addSubscriber', upload.fields([
    { name: 'trainingPlanFile', maxCount: 1 },
    { name: 'foodPlanFile', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const {
        name,
        email,
        phoneNumber,
        id,
        role,
        membershipStatus,
        trainerID,
        subscriptionPeriod
      } = req.body;
  
      if (!name || !email || !phoneNumber || !id || !subscriptionPeriod) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      // Check for existing subscriber
      const idDoc = await getDoc(doc(db, 'customers', id));
      if (idDoc.exists()) {
        return res.status(400).json({ message: 'Subscriber ID already exists' });
      }
  
      const emailQuery = query(collection(db, 'customers'), where('email', '==', email));
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
  
      // Create user in Firebase Auth
      await createUserWithEmailAndPassword(auth, email, id);
  
      // Calculate expiration date
      const now = new Date();
      let expirationDate;
      switch (subscriptionPeriod) {
        case '1': expirationDate = new Date(now.setMonth(now.getMonth() + 1)); break;
        case '3': expirationDate = new Date(now.setMonth(now.getMonth() + 3)); break;
        case '6': expirationDate = new Date(now.setMonth(now.getMonth() + 6)); break;
      }
  
      // Handle file uploads
      const trainingPlanFile = req.files['trainingPlanFile']?.[0];
      const foodPlanFile = req.files['foodPlanFile']?.[0];
  
      let trainingPlanURL = '';
      let foodPlanURL = '';
  
      if (trainingPlanFile) {
        const trainingRef = ref(storage, `TrainingPlans/${id}`);
        await uploadBytes(trainingRef, trainingPlanFile.buffer, {
          contentType: trainingPlanFile.mimetype, // ✅ Set the content type
        });
        trainingPlanURL = await getDownloadURL(trainingRef);
      }
      
      if (foodPlanFile) {
        const foodRef = ref(storage, `FoodPlans/${id}`);
        await uploadBytes(foodRef, foodPlanFile.buffer, {
          contentType: foodPlanFile.mimetype, // ✅ Set the content type
        });
        foodPlanURL = await getDownloadURL(foodRef);
      }
      // Set the current time for last updated
      
  
      // Save to Firestore
      await setDoc(doc(db, 'customers', id), {
        name,
        email,
        phoneNumber,
        id,
        role: Number(role),
        membershipStatus,
        trainerID,
        Participating_from: Timestamp.now(),
        expirationDate: Timestamp.fromDate(expirationDate),
        trainingPlanURL,
        foodPlanURL,
         trainingPlanLastUpdated: Timestamp.now(),
      foodPlanLastUpdated: Timestamp.now(),
      });
  
      // Optional: increment trainees count for the trainer
      const trainerDocRef = doc(db, 'Users', trainerID);
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(trainerDocRef);
        if (!docSnap.exists()) throw new Error('Trainer not found');
        const current = docSnap.data().traineesNumber || 0;
        transaction.update(trainerDocRef, { traineesNumber: current + 1 });
      });
  
      res.status(200).json({ message: 'Subscriber added successfully!' });
  
    } catch (error) {
      console.error('Error in /addSubscriber:', error);
      res.status(500).json({ message: 'Internal server error', error });
    }
  });
  
  router.post('/deleteCustomer', async (req, res) => {
    const { trainerID, customerID, email } = req.body;
    try {
      // Step 1: Delete Firestore document
      await deleteDoc(doc(db, 'customers', customerID));
  
      // Step 2: Get UID by email and delete from Auth
      try {
        const userRecord = await Authentication.getUserByEmail(email);
        await Authentication.deleteUser(userRecord.uid);
      } catch (authError) {
        console.warn(`⚠️ Could not delete auth user with email ${email}:`, Authentication.message);
      }
  
      // Step 3: Decrement trainee count
      const trainerRef = doc(db, 'Users', trainerID);
      await runTransaction(db, async (transaction) => {
        const trainerDoc = await transaction.get(trainerRef);
        if (!trainerDoc.exists()) throw new Error('Trainer not found');
        const current = trainerDoc.data().traineesNumber || 0;
        transaction.update(trainerRef, { traineesNumber: Math.max(current - 1, 0) });
      });
  
      res.status(200).json({ message: 'Customer deleted successfully' });
    } catch (error) {
      console.error('❌ Error deleting customer:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  
  // UPDATE CUSTOMER DETAILS
  router.post('/updateCustomer', async (req, res) => {
    const { customerID, name, phoneNumber, expirationDate } = req.body;
    try {
      const updates = {
        name,
        phoneNumber,
        expirationDate: expirationDate ? Timestamp.fromDate(new Date(expirationDate)) : undefined,
      };
      Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
  
      await updateDoc(doc(db, 'customers', customerID), updates);
      res.status(200).json({ message: 'Customer updated successfully' });
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  // TOGGLE STATUS
  router.post('/toggleStatus', async (req, res) => {
    const { customerID, status } = req.body;
    try {
      await updateDoc(doc(db, 'customers', customerID), { membershipStatus: status });
      res.status(200).json({ message: 'Status updated successfully' });
    } catch (error) {
      console.error('Error toggling status:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  // ADD MEASUREMENTS
  router.post('/addMeasurements', upload.array('images'), async (req, res) => {
    const { customerID } = req.body;
    const measurements = JSON.parse(req.body.measurements);
    try {
      const customerRef = doc(db, 'customers', customerID);
      const customerDoc = await getDoc(customerRef);
      if (!customerDoc.exists()) return res.status(404).json({ message: 'Customer not found' });
  
      const uploadedUrls = await Promise.all(req.files.map(async (file) => {
        const fileRef = ref(storage, `customers/${customerID}/images/${file.originalname}`);
        await uploadBytes(fileRef, file.buffer);
        return getDownloadURL(fileRef);
      }));
  
      const updatedWeek = {
        ...measurements,
        images: uploadedUrls,
        updatedAt: Timestamp.now()
      };
  
      const existingData = customerDoc.data();
      const newWeeks = existingData.weeks ? [...existingData.weeks, updatedWeek] : [updatedWeek];
      await updateDoc(customerRef, { weeks: newWeeks });
  
      res.status(200).json({ message: 'Measurements added successfully' });
    } catch (error) {
      console.error('Error adding measurements:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });




  ////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////

  // GET /MoDumbels/measurements/:customerId
router.get('/measurements/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const customerRef = doc(db, 'customers', customerId);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const data = customerSnap.data();
    res.json({ measurements: data.weeks || [] });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



router.post('/addMeasurement', upload.array('images'), async (req, res) => {
  try {
    const { customerId, newMeasurements } = req.body;
    if (!customerId || !newMeasurements) {
      return res.status(400).json({ message: 'Missing data' });
    }

    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    if (!customerDoc.exists()) return res.status(404).json({ message: 'Customer not found' });

    const existingData = customerDoc.data();
    const weeks = existingData.weeks || [];

    const uploadedImages = await Promise.all(req.files.map(async (file) => {
      const storageRef = ref(storage, `customers/${customerId}/images/${file.originalname}`);
      await uploadBytes(storageRef, file.buffer, { contentType: file.mimetype });
      return await getDownloadURL(storageRef);
    }));

    const updatedWeek = {
      ...JSON.parse(newMeasurements),
      updatedAt: Timestamp.now(),
      images: uploadedImages,
    };

    weeks.push(updatedWeek);

    await updateDoc(customerRef, { weeks });
    res.status(200).json({ message: 'Measurement added successfully', weeks });
  } catch (error) {
    console.error('Error in /addMeasurement:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// POST /MoDumbels/uploadPlans
router.post('/uploadPlans', upload.fields([
  { name: 'trainingPlan', maxCount: 1 },
  { name: 'foodPlan', maxCount: 1 }
]), async (req, res) => {
  const { customerId, firstName, lastName } = req.body;

  if (!customerId || !req.files) {
    return res.status(400).json({ message: 'Missing data or files' });
  }

  const trainingPlanFile = req.files['trainingPlan']?.[0];
  const foodPlanFile = req.files['foodPlan']?.[0];

  const addFooterAndSave = async (fileBuffer, originalName, folder) => {
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const pages = pdfDoc.getPages();

    const footerText = 'All rights reserved for © Fit Panel Company 2025';
    const userNameText = `${firstName} ${lastName}`;
    const uploadDate = new Date().toLocaleDateString('he-IL');

    const fs = require('fs');
    const path = require('path');
    
    // Resolve the local path to the image
    const iconPath = path.join(__dirname, '../fitpanel1.png'); // adjust the path based on your structure
    const iconBytes = fs.readFileSync(iconPath);
    
    // Embed the image in the PDF
    const iconImage = await pdfDoc.embedPng(iconBytes);

    for (const page of pages) {
      const { width, height } = page.getSize();

      page.drawImage(iconImage, {
        x: 30,
        y: height - 150,
        width: 120,
        height: 120,
      });

      page.drawText(uploadDate, {
        x: width - 150,
        y: height - 90,
        size: 12,
        color: rgb(0, 0, 0),
      });

      page.drawText(userNameText, {
        x: 50,
        y: 50,
        size: 12,
        color: rgb(0, 0, 0),
      });

      page.drawText(footerText, {
        x: 50,
        y: 30,
        size: 12,
        color: rgb(0, 0, 0),
      });
    }

    const modifiedPdf = await pdfDoc.save();
    const fileRef = ref(storage, `${folder}/${customerId}`);
    await uploadBytes(fileRef, Buffer.from(modifiedPdf), { contentType: 'application/pdf' });
    return await getDownloadURL(fileRef);
  };

  let trainingPlanURL = '';
  let foodPlanURL = '';

  try {
    if (trainingPlanFile) {
      trainingPlanURL = await addFooterAndSave(trainingPlanFile.buffer, trainingPlanFile.originalname, 'TrainingPlans');
    }

    if (foodPlanFile) {
      foodPlanURL = await addFooterAndSave(foodPlanFile.buffer, foodPlanFile.originalname, 'FoodPlans');
    }

   
    await updateDoc(doc(db, 'customers', customerId), {
      trainingPlanURL,
      foodPlanURL,
    });

     //add the time for saveing new urls
    const now = Timestamp.now();
    //svae the time in the customer document for the last update for both plans
    await updateDoc(doc(db, 'customers', customerId), {
      trainingPlanLastUpdated: now,
      foodPlanLastUpdated: now,
    });

    res.status(200).json({ message: 'Plans uploaded and saved', trainingPlanURL, foodPlanURL });

  } catch (error) {
    console.error('Error uploading plans:', error);
    res.status(500).json({ message: 'Upload failed', error });
  }
});

router.post('/deleteMeasurement', async (req, res) => {
  const { customerId, index } = req.body;

  if (!customerId || index === undefined) {
    return res.status(400).json({ message: 'Missing customerId or index' });
  }

  try {
    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);

    if (!customerDoc.exists()) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const data = customerDoc.data();
    const updatedWeeks = (data.weeks || []).filter((_, i) => i !== index);

    await updateDoc(customerRef, { weeks: updatedWeeks });

    res.status(200).json({ message: 'Measurement deleted successfully', weeks: updatedWeeks });
  } catch (error) {
    console.error('Error deleting measurement:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

router.post('/changePassword', async (req, res) => {
  const { email, newPassword,Userid } = req.body;
//print the email and newPassword
  console.log('Email:', email);
  console.log('New Password:', newPassword);
  console.log('Userid:', Userid);

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Missing email or new password' });
  }

  try {
    // 1. Get user by email
    const userRecord = await Authentication.getUserByEmail(email);

    // 2. Update password
    await Authentication.updateUser(userRecord.uid, { password: newPassword });


    // 3. Update Firestore (optional)
    // 3. Update Firestore (optional)
    const userRef = doc(db, 'Users', Userid);
    await updateDoc(userRef, { FirstLoggin: 1 });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
});

// GET /getTrainerDetails?trainerID=XXXX
router.get('/getTrainerDetails', async (req, res) => {
  const { trainerID } = req.query;

  if (!trainerID) {
    return res.status(400).json({ message: 'Missing trainerID' });
  }

  try {
    const qTrainer = query(collection(db, 'Users'), where('UserId', '==', trainerID));
    const snapshot = await getDocs(qTrainer);

    if (snapshot.empty) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    const trainerData = snapshot.docs[0].data();
    res.status(200).json({ trainer: trainerData });

  } catch (error) {
    console.error('Error fetching trainer details:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});


router.post('/deleteTrainer', async (req, res) => {
    const { TrainerId, email } = req.body;
    console.log(TrainerId)
    console.log(email)
    try {
      // Step 1: Delete Firestore document
      await deleteDoc(doc(db, 'Users', TrainerId));
  
      // Step 2: Get UID by email and delete from Auth
      try {
        const userRecord = await Authentication.getUserByEmail(email);
        await Authentication.deleteUser(userRecord.uid);
      } catch (authError) {
        console.warn(`⚠️ Could not delete auth user with email ${email}:`, Authentication.message);
      }
  
  
      res.status(200).json({ message: 'Trainner deleted successfully' });
    } catch (error) {
      console.error('❌ Error deleting Trainner:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });



router.post('/getUserDetails', async (req, res) => {
  const { email } = req.body;
  try {
    const usersQuery = query(collection(db, 'Users'), where('EmailAddress', '==', email));
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      return res.status(200).json(usersSnapshot.docs[0].data());
    }

    const customersQuery = query(collection(db, 'customers'), where('email', '==', email));
    const customersSnapshot = await getDocs(customersQuery);

    if (!customersSnapshot.empty) {
      return res.status(200).json(customersSnapshot.docs[0].data());
    }

    return res.status(404).json({ message: 'User not found' });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});




module.exports = router;
