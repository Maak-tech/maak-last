import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration - Replace these with your actual Firebase config
const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyBzfNXpiKb5LhpX347PTXIODpZ6M9XFblQ',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'maak-5caad.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'maak-5caad',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'maak-5caad.firebasestorage.app',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '827176918437',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    '1:827176918437:web:356fe7e2b4ecb3b99b1c4c',
  measurementId:
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-KZ279W9ELM',
};

// Initialize Firebase App (only if not already initialized)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase Auth
// Note: AsyncStorage persistence is automatically handled by Firebase v10+ when @react-native-async-storage/async-storage is installed
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Connect to emulators in development (optional)
if (__DEV__ && Platform.OS !== 'web') {
  // Uncomment these lines if you want to use Firebase emulators for development
  // Note: Make sure emulators are running first
  // try {
  //   connectAuthEmulator(auth, 'http://localhost:9099');
  //   connectFirestoreEmulator(db, 'localhost', 8080);
  //   connectStorageEmulator(storage, 'localhost', 9199);
  // } catch (error) {
  //   console.log('Emulator connection failed:', error);
  // }
}

export default app;
