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

function emptyRankingForUser(user) {
  const name = user.nick || user.name || "Tipster";

  return {
    id: user.uid,
    name,
    market: "Aguardando bilhetes",
    tips: 0,
    settledTips: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    staked: 0,
    profit: 0,
    averageOdd: 0,
    hitRate: 0,
    roi: 0,
    clv: 0,
    drawdown: 0,
    score: 0,
    chartPoints: [],
    source: "profile",
  };
}

export async function createPublicRankingProfile(user) {
  if (!firebaseEnabled || !user?.uid) return;

  const db = await getFirebaseDb();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, COLLECTION, user.uid), emptyRankingForUser(user));
}

export async function savePublicRankings(rankings) {
  if (!firebaseEnabled) return;

  const db = await getFirebaseDb();
  const { collection, deleteDoc, doc, getDocs, serverTimestamp, writeBatch } = await import("firebase/firestore");
  const usersSnapshot = await getDocs(collection(db, "users"));
  const nextRankings = new Map();

  usersSnapshot.docs.forEach((item) => {
    nextRankings.set(item.id, emptyRankingForUser({ uid: item.id, ...item.data() }));
  });

  rankings.forEach((ranking) => {
    nextRankings.set(ranking.id, {
      ...ranking,
      source: "computed",
      updatedAt: serverTimestamp(),
    });
  });

  const batch = writeBatch(db);
  nextRankings.forEach((ranking, id) => {
    batch.set(doc(db, COLLECTION, id), ranking, { merge: false });
  });
  await batch.commit();

  const rankingSnapshot = await getDocs(collection(db, COLLECTION));
  await Promise.all(
    rankingSnapshot.docs
      .filter((item) => !nextRankings.has(item.id) || item.id.startsWith("demo-"))
      .map((item) => deleteDoc(item.ref)),
  );
}

export { firebaseEnabled };
