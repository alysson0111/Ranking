const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);
let appPromise;
let dbPromise;

export async function getFirebaseApp() {
  if (!firebaseEnabled) return null;

  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp }) => initializeApp(firebaseConfig));
  }

  return appPromise;
}

export async function getFirebaseDb() {
  if (!firebaseEnabled) return null;

  if (!dbPromise) {
    dbPromise = Promise.all([getFirebaseApp(), import("firebase/firestore")]).then(
      ([app, { getFirestore }]) => getFirestore(app),
    );
  }

  return dbPromise;
}
