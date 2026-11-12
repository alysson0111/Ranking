import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , keyPath = "service-account.json"] = process.argv;
const serviceAccount = JSON.parse(readFileSync(resolve(keyPath), "utf8"));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

function profitForTip(tip) {
  const odd = Number(tip.ticketOdd || tip.odd);
  if (tip.result === "green") return Number(tip.stake) * (odd - 1);
  if (tip.result === "red") return -Number(tip.stake);
  if (tip.result === "push") return Number(tip.pushValue || tip.stake || 0) - Number(tip.stake || 0);
  return 0;
}

function calculateDrawdown(profits) {
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;

  profits.forEach((profit) => {
    equity += profit;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  });

  return maxDrawdown;
}

function normalize(value, min, max) {
  return Math.max(0, Math.min(1, (Number(value) - min) / (max - min)));
}

function calculateScore(tipster) {
  const roiScore = normalize(tipster.roi, -15, 25);
  const profitScore = normalize(tipster.profit, -10, 30);
  const hitRateScore = normalize(tipster.hitRate, 35, 70);
  const clvScore = normalize(tipster.clv, -5, 12);
  const drawdownPenalty = normalize(tipster.drawdown, 0, 35) * 0.15;

  return Math.round(
    100 *
      (roiScore * 0.34 +
        profitScore * 0.31 +
        hitRateScore * 0.15 +
        clvScore * 0.12 +
        normalize(tipster.settledTips, 3, 120) * 0.08 -
        drawdownPenalty),
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferSportFromTip(tip) {
  const groups = (tip.ticketSelections || []).map((item) => item.group);
  const normalized = normalizeText([tip.receiptText, tip.market, tip.pick, ...groups].join(" "));

  if (groups.some((group) => group === "Tênis") || /\btenis|tennis|handicap de games|vencedor\b/i.test(normalized)) {
    return "Tênis";
  }

  if (groups.some((group) => group === "FIFA") || /\bfifa|esports?|efootball|ea sports\b/i.test(normalized)) {
    return "FIFA";
  }

  if (
    groups.length ||
    /\bfutebol|total de gols|total de cartoes|total de cartões|total de escanteios|chance dupla|resultado final\b/i.test(
      normalized,
    )
  ) {
    return "Futebol";
  }

  return "";
}

function emptyRankingForUser(id, user) {
  return {
    id,
    name: user.nick || user.name || "Tipster",
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
    updatedAt: new Date().toISOString(),
  };
}

const users = await db.collection("users").get();
const rankings = new Map();

users.docs.forEach((item) => {
  rankings.set(item.id, emptyRankingForUser(item.id, item.data()));
});

const tips = await db.collection("tips").get();
tips.docs.forEach((item) => {
  const tip = item.data();
  const id = tip.tipsterId;
  const current =
    rankings.get(id) ||
    emptyRankingForUser(id, {
      nick: tip.tipsterName,
      name: tip.tipsterName,
    });
  const profit = Number(tip.profit ?? profitForTip(tip));
  const sport = tip.sport || inferSportFromTip(tip);

  current.name = tip.tipsterName || current.name;
  current.market = sport ? `${sport} - ${tip.market || "Bilhete"}` : tip.market || current.market;
  current.tips += 1;
  current.averageOdd += Number(tip.odd) || 0;
  current.clv += Number(tip.clv) || 0;

  if (tip.result !== "pending") {
    current.settledTips += 1;
    current.staked += Number(tip.stake) || 0;
    current.profit += profit;
    current.drawdown = current.drawdown || 0;
    current.profits = [...(current.profits || []), { placedAt: tip.placedAt, profit }];
    current.chartPoints = [
      ...(current.chartPoints || []),
      {
        id: item.id,
        placedAt: tip.placedAt,
        profit,
        result: tip.result,
      },
    ];
    if (tip.result === "green") current.wins += 1;
    if (tip.result === "red") current.losses += 1;
    if (tip.result === "push") current.pushes += 1;
  }

  rankings.set(id, current);
});

for (const ranking of rankings.values()) {
  const gradedTips = ranking.wins + ranking.losses;
  ranking.averageOdd = ranking.averageOdd / Math.max(ranking.tips, 1);
  ranking.clv = ranking.clv / Math.max(ranking.tips, 1);
  ranking.hitRate = (ranking.wins / Math.max(gradedTips, 1)) * 100;
  ranking.roi = (ranking.profit / Math.max(ranking.staked, 1)) * 100;
  ranking.drawdown = calculateDrawdown(
    (ranking.profits || [])
      .slice()
      .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt))
      .map((item) => item.profit),
  );
  ranking.chartPoints = (ranking.chartPoints || [])
    .slice()
    .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));
  ranking.score = calculateScore(ranking);
  ranking.source = ranking.tips ? "computed" : "profile";
  delete ranking.profits;
}

const batch = db.batch();
rankings.forEach((ranking, id) => {
  batch.set(db.collection("rankings").doc(id), ranking);
});
await batch.commit();

const publicRankings = await db.collection("rankings").get();
await Promise.all(
  publicRankings.docs
    .filter((item) => item.id.startsWith("demo-") || !rankings.has(item.id))
    .map((item) => item.ref.delete()),
);

console.log(`Ranking publico sincronizado com ${rankings.size} tipster(s) real(is).`);
