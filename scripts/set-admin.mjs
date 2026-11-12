import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , email, keyPath = "service-account.json"] = process.argv;

if (!email) {
  console.error("Uso: npm run admin:set -- email@dominio.com caminho-da-chave.json");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(resolve(keyPath), "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();
const db = getFirestore();
const user = await auth.getUserByEmail(email.trim().toLowerCase());

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  admin: true,
  role: "admin",
});

await db.collection("users").doc(user.uid).set(
  {
    role: "admin",
    isAdmin: true,
    adminGrantedAt: new Date().toISOString(),
  },
  { merge: true },
);

console.log(`Admin liberado para ${user.email} (${user.uid}).`);
console.log("Peca para esse usuario sair e entrar de novo no sistema.");
