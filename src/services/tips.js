import { firebaseEnabled, getFirebaseDb } from "./firebase";

const STORAGE_KEY = "tipster-rank-tips";
const COLLECTION = "tips";

function readLocalTips() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalTips(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listenToTips(onChange, onError) {
  if (!firebaseEnabled) {
    onChange(readLocalTips());
    return () => {};
  }

  let unsubscribe = () => {};

  getFirebaseDb()
    .then(async (db) => {
      const { collection, onSnapshot, orderBy, query } = await import("firebase/firestore");
      const tipsQuery = query(collection(db, COLLECTION), orderBy("placedAt", "desc"));
      unsubscribe = onSnapshot(
        tipsQuery,
        (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (error) => onError(new Error(`Erro ao ler apostas: ${error.message}`)),
      );
    })
    .catch((error) => onError(new Error(`Erro ao iniciar Firebase: ${error.message}`)));

  return () => unsubscribe();
}

export function listenToUserTips(userId, onChange, onError) {
  if (!firebaseEnabled) {
    onChange(readLocalTips().filter((tip) => tip.tipsterId === userId));
    return () => {};
  }

  let unsubscribe = () => {};

  getFirebaseDb()
    .then(async (db) => {
      const { collection, onSnapshot, orderBy, query, where } = await import("firebase/firestore");
      const tipsQuery = query(
        collection(db, COLLECTION),
        where("tipsterId", "==", userId),
        orderBy("placedAt", "desc"),
      );
      unsubscribe = onSnapshot(
        tipsQuery,
        (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (error) => onError(new Error(`Erro ao ler seus bilhetes: ${error.message}`)),
      );
    })
    .catch((error) => onError(new Error(`Erro ao iniciar Firebase: ${error.message}`)));

  return () => unsubscribe();
}

export async function addTip(tip) {
  if (firebaseEnabled) {
    const db = await getFirebaseDb();
    const { addDoc, collection } = await import("firebase/firestore");
    await addDoc(collection(db, COLLECTION), tip);
    return tip;
  }

  const saved = {
    ...tip,
    id: crypto.randomUUID(),
  };
  writeLocalTips([saved, ...readLocalTips()]);
  return saved;
}

export async function deleteTip(id) {
  if (firebaseEnabled) {
    const db = await getFirebaseDb();
    const { deleteDoc, doc } = await import("firebase/firestore");
    await deleteDoc(doc(db, COLLECTION, id));
    return;
  }

  writeLocalTips(readLocalTips().filter((tip) => tip.id !== id));
}

export async function updateTipResult(id, result, profit, pushValue = null) {
  const updatedAt = new Date().toISOString();
  const normalizedPushValue = result === "push" ? Number(pushValue || 0) : null;

  if (firebaseEnabled) {
    const db = await getFirebaseDb();
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, COLLECTION, id), {
      result,
      profit,
      pushValue: normalizedPushValue,
      resolvedAt: result === "pending" ? null : updatedAt,
      updatedAt,
    });
    return;
  }

  writeLocalTips(
    readLocalTips().map((tip) =>
      tip.id === id
        ? {
            ...tip,
            result,
            profit,
            pushValue: normalizedPushValue,
            resolvedAt: result === "pending" ? null : updatedAt,
            updatedAt,
          }
        : tip,
    ),
  );
}

export async function clearTips() {
  if (firebaseEnabled) {
    const db = await getFirebaseDb();
    const { collection, deleteDoc, getDocs } = await import("firebase/firestore");
    const snapshot = await getDocs(collection(db, COLLECTION));

    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
    return;
  }

  writeLocalTips([]);
}

export { firebaseEnabled };
