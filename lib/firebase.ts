import { Platform } from 'react-native';

// Mock Firebase for web platform to prevent crashes
const mockAuth = {
  currentUser: null,
  onAuthStateChanged: () => () => {},
  signInWithEmailAndPassword: async () => ({ user: { uid: 'demo' } }),
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'demo' } }),
  signOut: async () => {},
};

const mockDb = {
  collection: () => ({
    doc: () => ({
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async () => {},
    }),
  }),
};

const mockStorage = {
  ref: () => ({
    put: async () => ({ ref: { getDownloadURL: async () => 'mock-url' } }),
  }),
};

// For web platform, use mock implementations
export const auth = Platform.OS === 'web' ? mockAuth : mockAuth;
export const db = Platform.OS === 'web' ? mockDb : mockDb;
export const storage = Platform.OS === 'web' ? mockStorage : mockStorage;

// Mock Firebase app
const app = { name: 'mock-app' };
export default app;