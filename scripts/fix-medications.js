const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} = require('firebase/firestore');

// Firebase config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'maak-health-demo.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'maak-health-demo',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'maak-health-demo.appspot.com',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixMedications() {
  console.log('🔧 Fixing medications with missing or invalid reminders...');

  const userId = 'Ezqaeqp23sXWHMIJJ4ELwyah8RC3';

  try {
    // Get all medications for this user
    const q = query(
      collection(db, 'medications'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    console.log(`Found ${querySnapshot.size} medications`);

    let fixedCount = 0;

    for (const medicationDoc of querySnapshot.docs) {
      const data = medicationDoc.data();
      console.log(`Checking medication: ${data.name}`);
      console.log(`Current reminders:`, data.reminders, typeof data.reminders);

      // Check if reminders needs fixing
      if (!Array.isArray(data.reminders)) {
        console.log(`Fixing reminders for ${data.name}`);

        await updateDoc(doc(db, 'medications', medicationDoc.id), {
          reminders: [], // Set to empty array if not a proper array
        });

        fixedCount++;
        console.log(`✅ Fixed ${data.name}`);
      } else {
        console.log(`✅ ${data.name} already has proper reminders array`);
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} medications`);
  } catch (error) {
    console.error('❌ Error fixing medications:', error);
  }
}

fixMedications().then(() => {
  console.log('Done!');
  process.exit(0);
});
