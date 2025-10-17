import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyBzfNXpiKb5LhpX347PTXIODpZ6M9XFblQ',
  authDomain: 'maak-5caad.firebaseapp.com',
  projectId: 'maak-5caad',
  storageBucket: 'maak-5caad.firebasestorage.app',
  messagingSenderId: '827176918437',
  appId: '1:827176918437:web:356fe7e2b4ecb3b99b1c4c',
  measurementId: 'G-KZ279W9ELM',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

export default app;