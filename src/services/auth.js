import { firebaseEnabled, getFirebaseApp, getFirebaseDb } from "./firebase";

const LOCAL_USER_KEY = "tipster-rank-user";
const LOCAL_USERS_KEY = "tipster-rank-users";

function localUserFromEmail(email, name, nick, phone, createdAt) {
  return {
    uid: `local-${email.toLowerCase()}`,
    email,
    name: name || "",
    nick: nick || "",
    phone: phone || "",
    createdAt: createdAt || null,
    displayName: nick || "",
  };
}

function readLocalUser() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLocalUser(user) {
  if (user) {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_USER_KEY);
  }
}

function readLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function saveLocalProfile(user) {
  const users = readLocalUsers();
  users[user.email.toLowerCase()] = user;
  writeLocalUsers(users);
}

function findLocalProfile(email) {
  return readLocalUsers()[email.toLowerCase()] || null;
}

function normalizeFirebaseUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

async function loadUserProfile(user) {
  const normalizedUser = normalizeFirebaseUser(user);
  if (!normalizedUser || !firebaseEnabled) return normalizedUser;

  const db = await getFirebaseDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const profile = await getDoc(doc(db, "users", normalizedUser.uid));

  if (!profile.exists()) return normalizedUser;

  const data = profile.data();
  return {
    ...normalizedUser,
    name: data.name || "",
    nick: data.nick || "",
    phone: data.phone || "",
    displayName: data.nick || normalizedUser.displayName,
  };
}

export function listenToAuth(onChange) {
  if (!firebaseEnabled) {
    onChange(readLocalUser());
    return () => {};
  }

  let unsubscribe = () => {};

  getFirebaseApp().then(async (app) => {
    const { getAuth, onAuthStateChanged } = await import("firebase/auth");
    const auth = getAuth(app);
    unsubscribe = onAuthStateChanged(auth, async (user) => onChange(await loadUserProfile(user)));
  });

  return () => unsubscribe();
}

export async function signUp({ name, nick, phone, email, password }) {
  const createdAt = new Date().toISOString();
  const cleanName = name.trim();
  const cleanNick = nick.trim();
  const cleanPhone = phone.trim();
  const cleanEmail = email.trim();

  if (!cleanNick) {
    throw new Error("Informe o Nick para concluir o cadastro.");
  }

  if (!firebaseEnabled) {
    const user = localUserFromEmail(cleanEmail, cleanName, cleanNick, cleanPhone, createdAt);
    saveLocalProfile(user);
    writeLocalUser(user);
    return user;
  }

  const app = await getFirebaseApp();
  const { createUserWithEmailAndPassword, getAuth, updateProfile } = await import("firebase/auth");
  const credential = await createUserWithEmailAndPassword(getAuth(app), cleanEmail, password);
  await updateProfile(credential.user, { displayName: cleanNick });

  const db = await getFirebaseDb();
  const { doc, serverTimestamp, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, "users", credential.user.uid), {
    uid: credential.user.uid,
    name: cleanName,
    nick: cleanNick,
    phone: cleanPhone,
    email: credential.user.email,
    createdAt: serverTimestamp(),
    createdAtIso: createdAt,
    role: "tipster",
  });

  return {
    uid: credential.user.uid,
    email: credential.user.email,
    name: cleanName,
    nick: cleanNick,
    phone: cleanPhone,
    createdAt,
    displayName: cleanNick,
  };
}

export async function signIn(email, password) {
  if (!firebaseEnabled) {
    const user = findLocalProfile(email) || localUserFromEmail(email);
    writeLocalUser(user);
    return user;
  }

  const app = await getFirebaseApp();
  const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
  const credential = await signInWithEmailAndPassword(getAuth(app), email, password);
  return loadUserProfile(credential.user);
}

export async function signOutUser() {
  if (!firebaseEnabled) {
    writeLocalUser(null);
    window.location.reload();
    return;
  }

  const app = await getFirebaseApp();
  const { getAuth, signOut } = await import("firebase/auth");
  await signOut(getAuth(app));
}

export { firebaseEnabled };
