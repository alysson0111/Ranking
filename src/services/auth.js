import { firebaseEnabled, getFirebaseApp, getFirebaseDb } from "./firebase";
import { createPublicRankingProfile } from "./rankings";

const LOCAL_USER_KEY = "tipster-rank-user";
const LOCAL_USERS_KEY = "tipster-rank-users";

function validatePassword(password) {
  if (password.length < 8) {
    throw new Error("Use uma senha com pelo menos 8 caracteres.");
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Use uma senha com letra maiuscula, minuscula e numero.");
  }
}

function authErrorMessage(error) {
  if (error?.code === "auth/email-already-in-use") return "Este e-mail ja possui cadastro.";
  if (error?.code === "auth/weak-password") return "Use uma senha mais forte.";
  if (error?.code === "auth/invalid-email") return "Informe um e-mail valido.";
  if (error?.code === "auth/too-many-requests") return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return "Nao foi possivel entrar. Confira e-mail e senha.";
}

function localUserFromEmail(email, name, nick, phone, createdAt) {
  return {
    uid: `local-${email.toLowerCase()}`,
    email,
    name: name || "",
    nick: nick || "",
    phone: phone || "",
    createdAt: createdAt || null,
    displayName: nick || "",
    role: "tipster",
    isAdmin: false,
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

  const token = await user.getIdTokenResult();
  const db = await getFirebaseDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const profile = await getDoc(doc(db, "users", normalizedUser.uid));
  const claimsRole = token.claims.admin ? "admin" : token.claims.role;

  if (!profile.exists()) return normalizedUser;

  const data = profile.data();
  return {
    ...normalizedUser,
    name: data.name || "",
    nick: data.nick || "",
    phone: data.phone || "",
    displayName: data.nick || normalizedUser.displayName,
    role: claimsRole || data.role || "tipster",
    isAdmin: Boolean(token.claims.admin || claimsRole === "admin"),
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

  validatePassword(password);

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
  await createPublicRankingProfile({
    uid: credential.user.uid,
    name: cleanName,
    nick: cleanNick,
  });

  return {
    uid: credential.user.uid,
    email: credential.user.email,
    name: cleanName,
    nick: cleanNick,
    phone: cleanPhone,
    createdAt,
    displayName: cleanNick,
    role: "tipster",
    isAdmin: false,
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
  try {
    const credential = await signInWithEmailAndPassword(getAuth(app), email, password);
    return loadUserProfile(credential.user);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
}

export async function resetPassword(email) {
  if (!firebaseEnabled) throw new Error("Recuperacao de senha indisponivel neste ambiente.");
  const app = await getFirebaseApp();
  const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
  const auth = getAuth(app);
  auth.languageCode = "pt-BR";
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    if (error?.code === "auth/user-not-found") return;
    if (error?.code === "auth/invalid-email") throw new Error("Informe um e-mail valido.");
    if (error?.code === "auth/too-many-requests") throw new Error("Aguarde um pouco antes de tentar novamente.");
    throw new Error("Nao foi possivel enviar a recuperacao. Tente novamente em instantes.");
  }
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
