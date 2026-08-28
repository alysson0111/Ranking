import { firebaseEnabled, getFirebaseDb } from "./firebase";

const COLLECTION = "rankings";

export function listenToRankings(onChange, onError) {
  if (!firebaseEnabled) {
    onChange([]);
    return () => {};
  }

  let unsubscribe = () => {};

  getFirebaseDb()
    .then(async (db) => {
      const { collection, onSnapshot, orderBy, query } = await import("firebase/firestore");
      const rankingsQuery = query(collection(db, COLLECTION), orderBy("score", "desc"));
      unsubscribe = onSnapshot(
        rankingsQuery,
        (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
        (error) => onError(new Error(`Erro ao ler ranking: ${error.message}`)),
      );
    })
    .catch((error) => onError(new Error(`Erro ao iniciar Firebase: ${error.message}`)));

  return () => unsubscribe();
}

export { firebaseEnabled };
