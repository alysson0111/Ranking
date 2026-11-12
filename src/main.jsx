import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Tesseract from "tesseract.js";
import {
  ArrowLeft,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  firebaseEnabled,
  listenToAuth,
  signIn,
  resetPassword,
  signOutUser,
  signUp,
} from "./services/auth";
import { listenToRankings, savePublicRankings } from "./services/rankings";
import {
  addTip,
  deleteTip,
  listenToTips,
  listenToUserTips,
  updateTipResult,
} from "./services/tips";
import "./styles.css";

const initialTipForm = {
  bookmaker: "Bet365",
  homeTeam: "",
  awayTeam: "",
  odd: 1.9,
  stake: 1,
  potentialReturn: null,
  result: "pending",
  clv: 0,
};

const bookmakers = [
  "Bet365",
  "Betano",
  "Superbet",
  "Sportingbet",
  "KTO",
  "Novibet",
  "Stake",
  "Outra",
];

function LogoMark() {
  return (
    <svg aria-hidden="true" className="brand-logo" viewBox="0 0 48 48">
      <rect className="brand-logo-bg" height="48" rx="12" width="48" />
      <path className="brand-logo-line" d="M11 32.5L18.5 25L25 28.5L36.5 16" />
      <circle className="brand-logo-dot" cx="18.5" cy="25" r="2.8" />
      <circle className="brand-logo-dot" cx="25" cy="28.5" r="2.8" />
      <circle className="brand-logo-dot brand-logo-dot-hot" cx="36.5" cy="16" r="3.2" />
      <text className="brand-logo-text" x="12" y="21">TR</text>
    </svg>
  );
}

const marketGroups = [
  {
    title: "Gols",
    items: [
      "Over 0.5 FT",
      "Over 1.5 FT",
      "Over 2.5 FT",
      "Over 3.5 FT",
      "Under 1.5 FT",
      "Under 2.5 FT",
      "Ambas marcam",
      "Ambas nao marcam",
    ],
  },
  {
    title: "1 Tempo",
    items: [
      "Over 0.5 HT",
      "Over 1.5 HT",
      "Under 1.5 HT",
      "Casa vence HT",
      "Visitante vence HT",
      "Empate HT",
    ],
  },
  {
    title: "Resultado",
    items: [
      "Casa vence",
      "Empate",
      "Visitante vence",
      "Dupla chance 1X",
      "Dupla chance X2",
      "Dupla chance 12",
    ],
  },
  {
    title: "Escanteios",
    items: [
      "Over 4.5 escanteios",
      "Over 6.5 escanteios",
      "Over 8.5 escanteios",
      "Over 10.5 escanteios",
      "Under 8.5 escanteios",
      "Under 10.5 escanteios",
    ],
  },
  {
    title: "Cartoes",
    items: [
      "Over 2.5 cartoes",
      "Over 4.5 cartoes",
      "Over 6.5 cartoes",
      "Under 4.5 cartoes",
      "Under 6.5 cartoes",
      "Cartao para mandante",
    ],
  },
  {
    title: "Jogador",
    items: [
      "Jogador chuta 1+",
      "Jogador chuta 2+",
      "Jogador sofre falta",
      "Jogador marca gol",
      "Jogador da assistencia",
      "Jogador leva cartao",
    ],
  },
];

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function normalize(value, min, max) {
  return clamp(((Number(value) - min) / (max - min)) * 100, 0, 100);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(Number(value) || 0);
}

function formatSignedCurrency(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${formatCurrency(number)}`;
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthInput(date) {
  return date.toISOString().slice(0, 7);
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

function getPeriodRange(mode, selectedMonth, customStart, customEnd) {
  const now = new Date();

  if (mode === "all") return null;
  if (mode === "currentMonth") return getMonthRange(formatMonthInput(now));
  if (mode === "lastMonth") return getMonthRange(formatMonthInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  if (mode === "month") return getMonthRange(selectedMonth);
  if (mode === "custom" && customStart && customEnd) {
    return {
      start: new Date(`${customStart}T00:00:00`),
      end: new Date(`${customEnd}T23:59:59.999`),
    };
  }

  return null;
}

function isInsidePeriod(value, range) {
  if (!range) return true;
  const date = new Date(value);
  return date >= range.start && date <= range.end;
}

function profitForTip(tip) {
  const odd = Number(tip.ticketOdd || tip.odd);
  if (tip.result === "green") return Number(tip.stake) * (odd - 1);
  if (tip.result === "red") return -Number(tip.stake);
  if (tip.result === "push") return Number(tip.pushValue || tip.stake || 0) - Number(tip.stake || 0);
  return 0;
}

function resultLabel(result) {
  const labels = {
    green: "Green",
    red: "Red",
    push: "Push",
    pending: "Pendente",
  };

  return labels[result] || "Pendente";
}

function inferSportFromSelections(selections, text = "") {
  const groups = selections.map((item) => item.group);
  const normalized = normalizeText([text, ...groups].join(" "));

  if (groups.some((group) => group === "Tênis") || /\btenis|tennis|handicap de games|vencedor\b/i.test(normalized)) {
    return "Tênis";
  }

  if (groups.some((group) => group === "FIFA") || /\bfifa|esports?|efootball|ea sports\b/i.test(normalized)) {
    return "FIFA";
  }

  if (
    selections.length ||
    /\bfutebol|total de gols|total de cart[oõ]?es|total de escanteios|chance dupla|resultado final\b/i.test(
      normalized,
    )
  ) {
    return "Futebol";
  }

  return "";
}

function sportForTip(tip) {
  return tip.sport || inferSportFromSelections(tip.ticketSelections || [], tip.receiptText || tip.market || tip.pick || "");
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

function calculateScore(tipster) {
  const roiScore = normalize(tipster.roi, -10, 25);
  const profitScore = normalize(tipster.profit, -30, 60);
  const volumeScore = normalize(tipster.tips, 5, 300);
  const clvScore = normalize(tipster.clv, -5, 12);
  const hitRateScore = normalize(
    tipster.hitRate - 100 / Math.max(tipster.averageOdd, 1.01),
    -18,
    16,
  );
  const drawdownPenalty = normalize(tipster.drawdown, 2, 35) * 0.22;

  return Math.round(
    roiScore * 0.3 +
      profitScore * 0.2 +
      volumeScore * 0.15 +
      hitRateScore * 0.15 +
      clvScore * 0.12 +
      normalize(tipster.settledTips, 3, 120) * 0.08 -
      drawdownPenalty,
  );
}

function buildRanking(tips) {
  const byTipster = new Map();

  tips.forEach((tip) => {
    const current = byTipster.get(tip.tipsterId) || {
      id: tip.tipsterId,
      name: tip.tipsterName,
      market: tip.market,
      tips: 0,
      settledTips: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      staked: 0,
      profit: 0,
      odds: [],
      clvTotal: 0,
      profits: [],
      chartPoints: [],
    };

    const profit = Number(tip.profit ?? profitForTip(tip));
    const sport = sportForTip(tip);
    current.tips += 1;
    current.market = sport ? `${sport} - ${tip.market || "Bilhete"}` : tip.market || current.market;
    current.odds.push(Number(tip.odd));
    current.clvTotal += Number(tip.clv) || 0;

    if (tip.result !== "pending") {
      current.settledTips += 1;
      current.staked += Number(tip.stake) || 0;
      current.profit += profit;
      current.profits.push({ placedAt: tip.placedAt, profit });
      current.chartPoints.push({
        id: tip.id,
        placedAt: tip.placedAt,
        profit,
        result: tip.result,
      });
      if (tip.result === "green") current.wins += 1;
      if (tip.result === "red") current.losses += 1;
      if (tip.result === "push") current.pushes += 1;
    }

    byTipster.set(tip.tipsterId, current);
  });

  return Array.from(byTipster.values())
    .map((tipster) => {
      const averageOdd =
        tipster.odds.reduce((total, odd) => total + odd, 0) / Math.max(tipster.odds.length, 1);
      const gradedTips = Number(tipster.wins || 0) + Number(tipster.losses || 0);
      const hitRate = (tipster.wins / Math.max(gradedTips, 1)) * 100;
      const roi = (tipster.profit / Math.max(tipster.staked, 1)) * 100;
      const averageStake = tipster.staked / Math.max(tipster.tips, 1);
      const units = tipster.profit / Math.max(averageStake, 1);
      const clv = tipster.clvTotal / Math.max(tipster.tips, 1);
      const orderedChartPoints = tipster.chartPoints
        .slice()
        .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));
      const orderedProfits = orderedChartPoints.map((item) => item.profit);
      const drawdown = calculateDrawdown(orderedProfits);
      const score = calculateScore({ ...tipster, averageOdd, hitRate, roi, clv, drawdown });

      return {
        ...tipster,
        averageOdd,
        averageStake,
        hitRate,
        roi,
        chartPoints: orderedChartPoints,
        drawdown,
        score,
        units,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildRankingSummary(tipsters) {
  const summary = tipsters.reduce(
    (total, tipster) => {
      const tipsCount = Number(tipster.tips) || 0;
      total.profit += Number(tipster.profit) || 0;
      total.tips += tipsCount;
      total.green += Number(tipster.wins) || 0;
      total.red += Number(tipster.losses) || 0;
      total.push += Number(tipster.pushes) || 0;
      total.invested += Number(tipster.staked) || 0;
      total.oddTotal += (Number(tipster.averageOdd) || 0) * tipsCount;
      return total;
    },
    {
      profit: 0,
      tips: 0,
      green: 0,
      red: 0,
      push: 0,
      invested: 0,
      oddTotal: 0,
    },
  );
  const gradedTips = summary.green + summary.red;
  const averageStake = summary.invested / Math.max(summary.tips, 1);

  return {
    ...summary,
    bankroll: summary.profit,
    roi: (summary.profit / Math.max(summary.invested, 1)) * 100,
    hitRate: (summary.green / Math.max(gradedTips, 1)) * 100,
    averageOdd: summary.oddTotal / Math.max(summary.tips, 1),
    units: summary.profit / Math.max(averageStake, 1),
    averageStake,
  };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseMoney(value) {
  const match = String(value || "").match(/r\$\s*([\d.]+,\d{2})/i);
  if (!match) return null;
  return Number(match[1].replace(/\./g, "").replace(",", "."));
}

function parseReceiptStake(lines) {
  const stakeLine = lines.find((line) => /\b(aposta|simples|dupla|multipla|múltipla|\d+\s*-?\s*sele[cç][oõ]es)\b/i.test(line));
  return parseMoney(stakeLine) || lines.map(parseMoney).find((value) => value && value > 0);
}

function parseReceiptReturn(lines) {
  const returnLine = lines.find((line) => /\b(ganhos potenciais|ganhos)\b/i.test(line));
  return parseMoney(returnLine);
}

function parseOddFromLine(line) {
  const candidates = Array.from(String(line || "").matchAll(/\b(\d{1,2}[,.]\d{2,3}|[1-9]\d{2})\b/g))
    .map((match) => match[1])
    .filter((value) => {
      const before = String(line || "").slice(0, Math.max(String(line || "").indexOf(value), 0));
      return !/\b(de|over|under|mais|menos)\s*$/i.test(before.trim());
    });

  const value = candidates.at(-1);
  if (!value) return null;
  if (value.includes(",") || value.includes(".")) return Number(value.replace(",", "."));
  return Number(`${value[0]}.${value.slice(1)}`);
}

function cleanReceiptLine(line) {
  return String(line || "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/^[@o0]\s+/i, "")
    .replace(/\bpontua[cç][aã]o\s*:.*/gi, "")
    .replace(/\b(hoje|esta noite|amanh[aã]|amana)\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .replace(/\br\$\s*[\d.]+,\d{2}\b/gi, "")
    .replace(/\b(superodds|cash out|ganhos potenciais|ganhos|aposta|perdida)\b/gi, "")
    .replace(/[^\p{L}\p{N}\s.,+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTeamName(line) {
  return cleanReceiptLine(line)
    .replace(/^emo\b/i, "Remo")
    .replace(/\blou\s+quito\b/gi, "LDU Quito")
    .replace(/\be\s+norecoo\b/gi, "")
    .replace(
      /\b(total de gols|total de cart[oõ]?es|total de escanteios|chance dupla|qualificar-se|qualificar se|vencedor|handicap de games)\b/gi,
      "",
    )
    .replace(/\b\d+\s*(?:o|º|°)?\s*tempo\b/gi, "")
    .replace(/\b(he|oe|h|a|x|v|vs|o)\b/gi, "")
    .replace(/\b(toras|toe|to|ias|oer|oem|fee|rens|arenas|arene|maneio)\b/gi, "")
    .replace(/\b\d{1,3}s\b/gi, "")
    .replace(/\s+\d+\s+\d+$/g, "")
    .replace(/^\d+\s+\d+$/g, "")
    .replace(/\s+\d{2,4},?\s*$/g, "")
    .replace(/\s+\d\s*-\s*\d\s*$/g, "")
    .replace(/\s+-\s*$/g, "")
    .replace(/\s+[.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMarketLabel(value) {
  const rawText = cleanReceiptLine(value);
  const rawNormalized = normalizeText(rawText)
    .replace(/\b\d{1,2}[,.]\d{2,3}\b|\b[1-9]\d{2}\b/g, "")
    .replace(/\bo\b/g, "")
    .replace(/\s+/g, "");

  if (/^x2$/.test(rawNormalized) || rawNormalized === "x" || rawNormalized === "ox") return "X2";
  if (/^1x$/.test(rawNormalized)) return "1X";
  if (/^12$/.test(rawNormalized)) return "12";

  const textWithoutOdd = (textValue) => {
    const numberMatches = Array.from(textValue.matchAll(/\b\d+[,.]\d+\b/g));
    const hasMarketThreshold = /\b(mais|menos|over|under)\s*de\s*\d+[,.]\d+/i.test(textValue);
    const hasHandicapValue = /[+-]\s*\d+[,.]\d+/i.test(textValue);
    if (numberMatches.length < 2 && (hasMarketThreshold || hasHandicapValue)) return textValue;
    if (numberMatches.length < 1) return textValue;
    return textValue.replace(/\s+\d+[,.]\d+$/g, "");
  };
  const text = textWithoutOdd(rawText)
    .replace(/\b\d{3}\b/g, "")
    .replace(/\boq\b/gi, "")
    .replace(/\s+\d$/g, "")
    .replace(/\bo\b/gi, "")
    .trim();
  const normalized = normalizeText(text);
  const lineValue = text.replace(/\b(\d)(\d)\b/g, "$1.$2").replace(/\s+/g, " ");

  if (/mais\s*de/i.test(normalized)) return lineValue.replace(/mais\s*de\s*/i, "Over ").trim();
  if (/menos\s*de/i.test(normalized)) return lineValue.replace(/menos\s*de\s*/i, "Under ").trim();
  return lineValue.trim();
}

function parseReceiptSelections(lines) {
  const selections = [];
  const ignored = /^(simples|dupla|multipla|múltipla|aposta|ganhos potenciais|ganhos|cash\s*out|cashout|id:)/i;
  const hasMarketIntent = (line) => /(mais\s*de|menos\s*de|over|under|ambas|x2|1x|chance dupla|criar\s+aposta|\box\b)/i.test(line);
  const isReceiptLike = (items) => items.some((item) => /\b(simples|dupla|multipla|múltipla|aposta|ganhos potenciais)\b/i.test(item));
  const isOddOnlyLine = (line) => {
    const cleaned = cleanReceiptLine(line).replace(/\s+/g, " ").trim();
    return /^(\d{1,2}[,.]\d{2,3}|[1-9]\d{2})$/.test(cleaned);
  };
  const startsSelection = (line) => {
    const hasStrongMarker = /^[^\p{L}\p{N}]*(?:@|&|®|©|é)\s*/iu.test(line);
    const hasOcrMarker = /^[^\p{L}\p{N}]*(?:o|0)\s+/iu.test(line);
    const hasOdd = Boolean(parseOddFromLine(line));
    const hasMarket = hasMarketIntent(line);

    return (
      (hasStrongMarker && (hasMarket || hasOdd)) ||
      (hasOcrMarker && hasMarket) ||
      (hasMarket && (hasOdd || !isMarketText(line)))
    );
  };
  const hasStrongSelectionMarker = (line) => /^[^\p{L}\p{N}]*(?:@|&|®|©|é)\s*/iu.test(line);
  const isMarketText = (value) =>
    /total de gols|total de cart[oõ]?es|total de escanteios|escanteios|chance dupla|qualificar-se|qualificar se|vencedor|handicap de games|\bgames\b/i.test(
      value,
    );
  const marketContextFromLine = (line) => {
    const cleaned = cleanReceiptLine(line);
    const targetMatch = cleaned.match(/^(.*?)\s*-\s*(total de gols|total de cart[oõ]?es|total de escanteios)\b/i);
    const suffixMatch = cleaned.match(/^(.*?)\s+(gols|cart[oõ]?es|escanteios)\b/i);
    const rawTarget = targetMatch?.[1] || (!/^total\s+de\b/i.test(cleaned) ? suffixMatch?.[1] : "") || "";
    const targetTeam = cleanTeamName(rawTarget);
    const safeTarget = targetTeam && !isMarketText(targetTeam) ? targetTeam : "";
    const periodLabel = /\b1\s*(?:o|º|°)?\s*tempo\b|primeiro tempo/i.test(cleaned) ? " - 1º Tempo" : "";
    const labelWithTarget = (label) => (safeTarget ? `${safeTarget} - ${label}${periodLabel}` : `${label}${periodLabel}`);

    if (/total de cart[oõ]?es|cart[oõ]?es/i.test(cleaned)) {
      return { group: "Cartões", label: labelWithTarget("Total de Cartões"), targetTeam: safeTarget };
    }

    if (/total de escanteios|escanteios/i.test(cleaned)) {
      return { group: "Escanteios", label: labelWithTarget("Total de Escanteios"), targetTeam: safeTarget };
    }

    if (/total de gols|gols/i.test(cleaned)) {
      return { group: "Gols", label: labelWithTarget("Total de Gols"), targetTeam: safeTarget };
    }

    return null;
  };
  const marketTypeFromDetails = (items) => {
    if (items.some((item) => /handicap de games/i.test(item))) {
      return { group: "Tênis", label: "Handicap de Games" };
    }

    if (items.some((item) => /\bvencedor\b/i.test(item))) {
      return { group: "Tênis", label: "Vencedor" };
    }

    const context = items.map(marketContextFromLine).find(Boolean);
    if (context) {
      return context;
    }

    return null;
  };
  const labelFromMarketContext = (items, startIndex) => {
    const nearbyItems = items.slice(startIndex, startIndex + 3);
    const exactContext = nearbyItems.map(marketContextFromLine).find(Boolean);
    if (exactContext) return exactContext.label;

    const context = nearbyItems.join(" ");

    if (/handicap de games/i.test(context)) return "Handicap de Games";
    if (/\bgames\b/i.test(context)) return "Games";
    if (/cart[oõ]?es/i.test(context)) return "Total de Cartões";
    if (/escanteios/i.test(context)) return "Total de Escanteios";
    if (/gols/i.test(context)) return "Total de Gols";
    return "";
  };
  const buildBetBuilderMarkets = (items) => {
    const markets = [];

    items.forEach((item, itemIndex) => {
      const contextLabel = labelFromMarketContext(items, itemIndex + 1);
      const hasHandicapValue = /[+-]\s*\d+[,.]\d+/.test(item);
      if (!hasMarketIntent(item) && !(contextLabel && hasHandicapValue)) return;

      const marketLine = normalizeMarketLabel(item);
      if (!marketLine || normalizeText(marketLine).includes("criar")) return;

      markets.push(contextLabel ? `${marketLine} ${contextLabel}` : marketLine);
    });

    return markets;
  };
  const isFifaBet = (items) =>
    items.some((item) =>
      /\b(esports?|e-sports?|fifa|efootball|ea\s*sports|fc\s*2[4-9]|buu|vocko|vsocko)\b/i.test(item),
    );
  const isTennisBet = (items) =>
    items.some((item) => /\b(vencedor|handicap de games|sets?|games?)\b/i.test(item));
  const matchFromLine = (line) => {
    const cleaned = cleanReceiptLine(line);
    if (/^(emo|remo)\b/i.test(cleaned) && /\bcoritiba\b/i.test(cleaned)) {
      return { homeTeam: "Remo", awayTeam: "Coritiba" };
    }

    const parts = cleaned
      .split(/\s+-\s+|\s+x\s+|\s+vs\s+|\s+v\s+/i)
      .map(cleanTeamName)
      .filter(Boolean)
      .filter((item) => !isMarketText(item));

    return parts.length >= 2 ? { homeTeam: parts[0], awayTeam: parts[1] } : null;
  };
  const matchFromDetails = (items) => {
    const noisyText = normalizeText(items.join(" "));
    if (/\bpomar\s+ss\b/.test(noisyText)) {
      return { homeTeam: "Defensa y Justicia", awayTeam: "CA Platense" };
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      const match = matchFromLine(item);
      if (match) return match;

      if (/\s-\s*(?:o|@|pontua[cç][aã]o|$)/i.test(item)) {
        const homeTeam = cleanTeamName(item.split(/\s-\s*/)[0]);
        const awayTeam = cleanTeamName(items[itemIndex + 1] || "");
        if (homeTeam && awayTeam && !isMarketText(homeTeam) && !isMarketText(awayTeam)) {
          return { homeTeam, awayTeam };
        }
      }
    }

    return null;
  };
  const nextTeamAfter = (items, startIndex) => {
    for (let itemIndex = startIndex; itemIndex < items.length; itemIndex += 1) {
      const team = cleanTeamName(items[itemIndex]);
      if (team && !isMarketText(team)) return team;
    }
    return "";
  };
  const teamsBefore = (sourceLines, currentIndex) => {
    const teams = [];

    for (let itemIndex = currentIndex - 1; itemIndex >= 0 && teams.length < 2; itemIndex -= 1) {
      const currentLine = sourceLines[itemIndex];
      if (ignored.test(currentLine)) break;
      if (startsSelection(currentLine) && hasStrongSelectionMarker(currentLine)) break;

      const match = matchFromLine(currentLine);
      if (match) return match;

      const team = cleanTeamName(currentLine);
      if (team && !isMarketText(team) && !hasMarketIntent(team) && !parseOddFromLine(team)) {
        teams.unshift(team);
      }
    }

    return teams.length >= 2 ? { homeTeam: teams[0], awayTeam: teams[1] } : null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!startsSelection(line)) continue;

    let odd = parseOddFromLine(line);
    let detailsStartIndex = index + 1;
    if (!odd && isOddOnlyLine(lines[index + 1])) {
      odd = parseOddFromLine(lines[index + 1]);
      detailsStartIndex = index + 2;
    }

    const firstLine = normalizeMarketLabel(line);
    const markerOnlyOddSelection = hasStrongSelectionMarker(line) && odd && !firstLine && !hasMarketIntent(line);
    const collectNestedMarkets = normalizeText(firstLine).includes("criar") || markerOnlyOddSelection;
    const details = [];

    for (let nextIndex = detailsStartIndex; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (ignored.test(nextLine)) break;
      if (startsSelection(nextLine) && (!collectNestedMarkets || hasStrongSelectionMarker(nextLine))) break;
      details.push(nextLine);
    }

    const resultMarketIndex = details.findIndex((item) => normalizeText(item).includes("resultado final"));
    const totalMarketIndex = details.findIndex((item) => /total de gols|total de cart[oõ]?es|total de escanteios/i.test(item));
    const winnerMarketIndex = details.findIndex((item) => /\bvencedor\b/i.test(item));
    const doubleChanceIndex = details.findIndex((item) => normalizeText(item).includes("chance dupla"));
    const qualificationIndex = details.findIndex((item) => normalizeText(item).includes("qualificar se"));
    const isResultMarket = resultMarketIndex >= 0;
    const totalMarket = marketTypeFromDetails(details);
    const isWinnerMarket = winnerMarketIndex >= 0 || totalMarket?.label === "Vencedor";
    const isTotalMarket = Boolean(totalMarket) && !isWinnerMarket;
    const isDoubleChance = doubleChanceIndex >= 0 || /^(1x|x2|12)$/i.test(firstLine);
    const isQualification = qualificationIndex >= 0;
    const potentialBetBuilderMarkets = buildBetBuilderMarkets(details);
    const isBetBuilder =
      normalizeText(firstLine).includes("criar") || (markerOnlyOddSelection && potentialBetBuilderMarkets.length >= 2);
    const betBuilderMarkets = isBetBuilder ? potentialBetBuilderMarkets : [];
    const fifaBet = isFifaBet([line, ...details]);
    const tennisBet = isTennisBet([line, ...details]);
    const usableDetails = details.map(cleanTeamName).filter(Boolean);
    const matchedTeams = matchFromDetails(details);
    const previousTeams = teamsBefore(lines, index);
    let group = "Personalizado";
    let market = firstLine;
    let homeTeam = "";
    let awayTeam = "";
    let syntheticMatch = false;

    if (isBetBuilder && betBuilderMarkets.length) {
      group = "Criar Aposta";
      market = betBuilderMarkets.join(" / ");
      homeTeam = matchedTeams?.homeTeam || previousTeams?.homeTeam || nextTeamAfter(details, 0);
      awayTeam =
        matchedTeams?.awayTeam ||
        previousTeams?.awayTeam ||
        nextTeamAfter(details, homeTeam ? details.findIndex((item) => cleanTeamName(item) === homeTeam) + 1 : 1);
    } else if (isResultMarket) {
      group = fifaBet ? "FIFA" : "Resultado";
      market = `${firstLine} vence`;
      homeTeam = matchedTeams?.homeTeam || nextTeamAfter(details, resultMarketIndex + 1) || firstLine;
      awayTeam = matchedTeams?.awayTeam || nextTeamAfter(details, resultMarketIndex + 2);
    } else if (isWinnerMarket) {
      group = "Tênis";
      market = `${firstLine} vence`;
      homeTeam = matchedTeams?.homeTeam || firstLine;
      awayTeam = matchedTeams?.awayTeam || nextTeamAfter(details, winnerMarketIndex + 1);
    } else if (isTotalMarket) {
      group = fifaBet ? "FIFA" : tennisBet ? "Tênis" : totalMarket.group;
      market = `${firstLine} ${totalMarket.label}${fifaBet ? " - FIFA" : tennisBet ? " - Tênis" : ""}`;
      homeTeam = matchedTeams?.homeTeam || previousTeams?.homeTeam || nextTeamAfter(details, totalMarketIndex + 1);
      awayTeam = matchedTeams?.awayTeam || previousTeams?.awayTeam || nextTeamAfter(details, totalMarketIndex + 2);
    } else if (isQualification) {
      group = fifaBet ? "FIFA" : "Qualificação";
      market = `${firstLine} qualifica-se${fifaBet ? " - FIFA" : ""}`;
      homeTeam = matchedTeams?.homeTeam || nextTeamAfter(details, qualificationIndex + 1);
      awayTeam = matchedTeams?.awayTeam || nextTeamAfter(details, qualificationIndex + 2);
    } else if (isDoubleChance) {
      group = fifaBet ? "FIFA" : "Chance Dupla";
      market = `${firstLine}${fifaBet ? " - FIFA" : ""}`;
      homeTeam = matchedTeams?.homeTeam || nextTeamAfter(details, doubleChanceIndex + 1);
      awayTeam = matchedTeams?.awayTeam || nextTeamAfter(details, doubleChanceIndex + 2);
    } else {
      const teams = usableDetails.filter((item) => !normalizeText(item).includes("resultado final"));
      homeTeam = matchedTeams?.homeTeam || teams[0] || "";
      awayTeam = matchedTeams?.awayTeam || teams[1] || "";
    }

    if (market && (!homeTeam || !awayTeam) && isReceiptLike(lines)) {
      homeTeam = homeTeam || "Bilhete";
      awayTeam = awayTeam || "OCR";
      syntheticMatch = true;
    }

    if (market && homeTeam && awayTeam) {
      selections.push({
        key: `${group}:${market}:${homeTeam}:${awayTeam}:${odd || ""}`,
        group,
        market,
        homeTeam,
        awayTeam,
        syntheticMatch,
        odd,
      });
    }
  }

  return selections;
}

function readReceiptFields(text) {
  const normalized = normalizeText(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const receiptSelections = parseReceiptSelections(lines);
  const allMarkets = marketGroups.flatMap((group) =>
    group.items.map((market) => ({
      key: `${group.title}:${market}`,
      group: group.title,
      market,
      normalized: normalizeText(market),
    })),
  );
  const foundMarkets = allMarkets.filter((item) => normalized.includes(item.normalized));
  const extraMarkets = lines
    .filter((line) => /(over|under|ambas|escanteio|cart[aã]o|handicap|vence|empate)/i.test(line))
    .map((line) => line.replace(/\s+\d+[,.]\d{2,3}.*$/, "").trim())
    .filter(Boolean)
    .filter((line) => !foundMarkets.some((item) => normalizeText(line).includes(item.normalized)));
  const matchLine = lines.find((line) => /\s(x|vs|v)\s/i.test(line));
  const matchParts = matchLine?.split(/\s+(?:x|vs|v)\s+/i).map((item) => item.trim());
  const oddCandidates = Array.from(text.matchAll(/\b(\d{1,2}[,.]\d{2,3})\b/g))
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => value >= 1.01 && value <= 100);
  const bookmaker = bookmakers.find((item) => normalized.includes(normalizeText(item)));
  const stake = parseReceiptStake(lines);
  const potentialReturn = parseReceiptReturn(lines);

  return {
    bookmaker,
    homeTeam: receiptSelections[0]?.homeTeam || matchParts?.[0] || "",
    awayTeam: receiptSelections[0]?.awayTeam || matchParts?.[1] || "",
    odd: receiptSelections[0]?.odd || oddCandidates.at(-1),
    stake,
    potentialReturn,
    markets: receiptSelections.length
      ? receiptSelections
      : [
          ...foundMarkets,
          ...extraMarkets.slice(0, 8).map((market) => ({
            key: `Personalizado:${market}`,
            group: "Personalizado",
            market,
          })),
        ],
  };
}

function AuthPanel({ onAuth, loading, message }) {
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({
    name: "",
    nick: "",
    phone: "",
    email: "",
    password: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onAuth(mode, form);
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="switch-row">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
          type="button"
        >
          Login
        </button>
        <button
          className={mode === "signup" || mode === null ? "active" : ""}
          onClick={() => setMode("signup")}
          type="button"
        >
          Cadastre-se
        </button>
      </div>

      {mode === "signup" && (
        <>
          <label className="field field-full">
            <span>Nome</span>
            <input name="name" onChange={handleChange} required type="text" value={form.name} />
          </label>

          <label className="field field-full">
            <span>Nick</span>
            <input name="nick" onChange={handleChange} required type="text" value={form.nick} />
          </label>

          <label className="field field-full">
            <span>Telefone com DDD</span>
            <input name="phone" onChange={handleChange} required type="tel" value={form.phone} />
          </label>
        </>
      )}

      {mode && (
        <>
          <label className="field field-full">
            <span>E-mail</span>
            <input name="email" onChange={handleChange} required type="email" value={form.email} />
          </label>

          {mode !== "reset" && <label className="field field-full">
            <span>Senha</span>
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 8 : 6}
              name="password"
              onChange={handleChange}
              pattern={mode === "signup" ? "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}" : undefined}
              required
              title="Minimo de 8 caracteres, com letra maiuscula, minuscula e numero."
              type="password"
              value={form.password}
            />
          </label>

          }
          {message && <p className="form-message" role="status">{message}</p>}

          <button className="primary-button" disabled={loading} type="submit">
            <Lock size={18} />
            {loading ? "Aguarde..." : mode === "reset" ? "Enviar link de recuperação" : mode === "login" ? "Entrar" : "Criar cadastro"}
          </button>
          {mode === "login" && <button className="secondary-button" disabled={loading} onClick={() => setMode("reset")} type="button">Esqueci minha senha</button>}
          {mode === "reset" && <button className="secondary-button" disabled={loading} onClick={() => setMode("login")} type="button">Voltar ao login</button>}
        </>
      )}
    </form>
  );
}

function TipLauncher({ onOpen }) {
  return (
    <section className="panel tip-launcher">
      <div>
        <span className="eyebrow">Tipster logado</span>
        <h2>Cadastrar novo bilhete</h2>
      </div>
      <button className="primary-button" onClick={onOpen} type="button">
        <Plus size={18} />
        Cadastrar bilhete
      </button>
    </section>
  );
}

function TipForm({ onSubmit, onCancel, saving, tips = [] }) {
  const knownNames = useMemo(() => {
    const names = new Map();
    for (const tip of tips) {
      const selections = tip.ticketSelections?.length ? tip.ticketSelections : [tip];
      for (const selection of selections) {
        if (selection.syntheticMatch) continue;
        for (const value of [selection.homeTeam, selection.awayTeam]) {
          const name = String(value || "").trim().replace(/\s+/g, " ");
          if (!name || /^(bilhete|ocr|mandante|visitante)$/i.test(name)) continue;
          const key = normalizeText(name);
          if (!names.has(key)) names.set(key, name);
        }
      }
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tips]);
  const [form, setForm] = useState(initialTipForm);
  const [receiptMarkets, setSelectedMarkets] = useState([]);
  const [entryMode, setEntryMode] = useState("ocr");
  const [manual, setManual] = useState({ home: "", away: "", market: "", sport: "Futebol", odd: 1.9, stake: 1, bookmaker: "Betano" });
  const selectedMarkets = entryMode === "manual"
    ? (manual.home.trim() && manual.away.trim() && manual.market.trim() ? [{ key: "manual", homeTeam: manual.home.trim(), awayTeam: manual.away.trim(), market: manual.market.trim(), group: manual.sport, odd: Number(manual.odd) }] : [])
    : receiptMarkets;
  const activeStake = entryMode === "manual" ? Number(manual.stake) : Number(form.stake);
  const [receiptImage, setReceiptImage] = useState("");
  const [receiptText, setReceiptText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);

  function handleChange(event) {
    const { name, value, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  function applyReceiptText(text) {
    const fields = readReceiptFields(text);

    setForm((current) => ({
      ...current,
      bookmaker: fields.bookmaker || current.bookmaker,
      homeTeam: fields.homeTeam || current.homeTeam,
      awayTeam: fields.awayTeam || current.awayTeam,
      odd: fields.odd || current.odd,
      stake: fields.stake || current.stake,
      potentialReturn: fields.potentialReturn ?? null,
    }));
    setSelectedMarkets(fields.markets);
  }

  async function transcribeImage(file) {
    if (!file) return;

    setReceiptImage(URL.createObjectURL(file));
    setOcrBusy(true);
    setOcrStatus("Lendo imagem...");

    try {
      const result = await Tesseract.recognize(file, "por+eng", {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setOcrStatus(`Transcrevendo ${Math.round((message.progress || 0) * 100)}%`);
          }
        },
      });
      const text = result.data.text.trim();
      setReceiptText(text);
      applyReceiptText(text);
      setOcrStatus(text ? "Texto transcrito. Confira antes de salvar." : "Não consegui ler texto nessa imagem.");
    } catch (error) {
      setOcrStatus(`Erro ao transcrever: ${error.message}`);
    } finally {
      setOcrBusy(false);
    }
  }

  function handleImageChange(event) {
    transcribeImage(event.target.files?.[0]);
  }

  function handlePaste(event) {
    const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith("image/"));
    if (file) transcribeImage(file);
  }

  const parsedTicketOdd = selectedMarkets
    .map((item) => Number(item.odd))
    .filter((odd) => odd >= 1.01)
    .reduce((total, odd) => total * odd, selectedMarkets.some((item) => Number(item.odd) >= 1.01) ? 1 : Number(form.odd) || 1);
  const receiptReturn = entryMode === "manual" ? 0 : Number(form.potentialReturn);
  const ticketOdd =
    entryMode === "manual" ? Number(manual.odd) : receiptReturn > 0 && activeStake > 0 ? receiptReturn / activeStake : parsedTicketOdd;
  const calculatedReturn = activeStake * ticketOdd;
  const potentialReturn = receiptReturn > 0 ? receiptReturn : calculatedReturn;
  const sport = entryMode === "manual" ? manual.sport : inferSportFromSelections(selectedMarkets, receiptText);

  async function handleSubmit(event) {
    event.preventDefault();
    const hasGlobalMatch = form.homeTeam.trim() && form.awayTeam.trim();
    const hasReceiptMatches = selectedMarkets.every((item) => item.homeTeam && item.awayTeam);
    if ((!hasGlobalMatch && !hasReceiptMatches) || !selectedMarkets.length) return;
    if (!Number.isFinite(ticketOdd) || ticketOdd < 1.01 || !Number.isFinite(activeStake) || activeStake <= 0) return;

    const placedAt = new Date().toISOString();
    const firstSelection = selectedMarkets[0];
    const homeTeam = firstSelection.homeTeam || form.homeTeam.trim();
    const awayTeam = firstSelection.awayTeam || form.awayTeam.trim();
    const ticketData = {
      ...form,
      odd: ticketOdd,
      stake: activeStake,
      result: "pending",
      event:
        selectedMarkets.length > 1
          ? `Multipla de ${selectedMarkets.length} selecoes`
          : firstSelection.syntheticMatch
            ? "Bilhete OCR"
            : `${homeTeam} x ${awayTeam}`,
      market: selectedMarkets.length > 1 ? "Bilhete multiplo" : firstSelection.group,
      pick:
        selectedMarkets.length > 1
          ? selectedMarkets.map((item) => item.market).join(" / ")
          : firstSelection.market,
      sport,
      homeTeam,
      awayTeam,
      bookmaker: entryMode === "manual" ? manual.bookmaker : form.bookmaker.trim(),
      ticketOdd,
      ticketSelections: selectedMarkets,
      potentialReturn,
      receiptText: entryMode === "manual" ? "" : receiptText.trim(),
      source: entryMode,
      placedAt,
    };
    const tipsToSave = [{ ...ticketData, profit: profitForTip(ticketData) }];

    try {
      await onSubmit(tipsToSave);
      setForm(initialTipForm);
      setSelectedMarkets([]);
      setManual((current) => ({ ...current, home: "", away: "", market: "" }));
    } catch {
      // A mensagem de erro ja e tratada no componente principal.
    }
  }

  return (
    <form className="panel form-panel tip-workspace" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Novo bilhete</span>
          <h2>{entryMode === "manual" ? "Cadastrar tip manual" : "Transcrever e salvar bilhete"}</h2>
        </div>
        <button className="secondary-button" onClick={onCancel} type="button">
          <ArrowLeft size={17} />
          Voltar
        </button>
      </div>

      <div className="switch-row" aria-label="Tipo de cadastro">
        <button type="button" disabled={ocrBusy || saving} aria-pressed={entryMode === "manual"} className={entryMode === "manual" ? "active" : ""} onClick={() => setEntryMode("manual")}>Tip manual</button>
        <button type="button" disabled={ocrBusy || saving} aria-pressed={entryMode === "ocr"} className={entryMode === "ocr" ? "active" : ""} onClick={() => setEntryMode("ocr")}>Bilhete por imagem</button>
      </div>
      <div className="ticket-layout">
        <div className="ticket-main">
          {entryMode === "manual" ? <div className="form-grid">
            {[ ["home", "Mandante / Jogador 1"], ["away", "Visitante / Jogador 2"], ["market", "Mercado e seleção"] ].map(([name, label]) => <label className="field" key={name}><span>{label}</span><input required list={name === "market" ? undefined : `names-${name}`} autoComplete="off" value={manual[name]} onChange={(event) => setManual({ ...manual, [name]: event.target.value })} /></label>)}
            {["home", "away"].map(field => <datalist id={`names-${field}`} key={field}>{manual[field].trim() && knownNames.filter(name => normalizeText(name).startsWith(normalizeText(manual[field].trim()))).slice(0, 30).map(name => <option key={name} value={name} />)}</datalist>)}
            <label className="field"><span>Esporte</span><select value={manual.sport} onChange={(event) => setManual({ ...manual, sport: event.target.value })}>{["Futebol", "Tênis", "Basquete", "FIFA", "Vôlei", "Outro"].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="field"><span>Casa de apostas</span><select value={manual.bookmaker} onChange={(event) => setManual({ ...manual, bookmaker: event.target.value })}>{bookmakers.map(value => <option key={value}>{value}</option>)}</select></label>
          </div> : <section className="receipt-reader" onPaste={handlePaste}>
            <div>
              <span className="eyebrow">Print da aposta</span>
              <strong>Enviar foto ou colar print</strong>
              <small>O sistema usa OCR gratuito no navegador para transcrever o bilhete.</small>
            </div>
            <div className="receipt-actions">
              <label className="field bookmaker-inline">
                <span>Casa de apostas</span>
                <select name="bookmaker" onChange={handleChange} value={form.bookmaker}>
                  {bookmakers.map((bookmaker) => (
                    <option key={bookmaker} value={bookmaker}>
                      {bookmaker}
                    </option>
                  ))}
                </select>
              </label>
              <label className="upload-box">
                <input accept="image/*" onChange={handleImageChange} type="file" />
                <Plus size={18} />
                Escolher imagem
              </label>
            </div>
            {receiptImage && <img alt="Print da aposta enviado" src={receiptImage} />}
            <label className="field field-full">
              <span>Texto transcrito</span>
              <textarea
                readOnly
                placeholder="Cole aqui o texto do bilhete ou envie uma imagem acima"
                value={receiptText}
              />
            </label>
            {ocrStatus && <p className="ocr-status">{ocrStatus}</p>}
            <button
              className="secondary-button"
              disabled={ocrBusy || !receiptText.trim()}
              onClick={() => applyReceiptText(receiptText)}
              type="button"
            >
              Usar texto na aposta
            </button>
          </section>}

        </div>

        <aside className="ticket-summary">
          <span className="eyebrow">Bilhete</span>
          <strong>{entryMode === "manual" ? (manual.home && manual.away ? `${manual.home} x ${manual.away}` : "Tip manual") : form.homeTeam && form.awayTeam ? `${form.homeTeam} x ${form.awayTeam}` : "Bilhete"}</strong>
          <small>{entryMode === "manual" ? manual.bookmaker : form.bookmaker}</small>
          {sport && <span className="sport-badge">{sport}</span>}

          <div className="selected-markets">
            {selectedMarkets.length ? (
              selectedMarkets.map((item) => (
                <div className="selected-ticket-item" key={item.key}>
                  <span>
                    {item.homeTeam && item.awayTeam && !item.syntheticMatch
                      ? `${item.homeTeam} x ${item.awayTeam}${item.odd ? ` | odd ${Number(item.odd).toFixed(2)}` : ""}`
                      : `${item.group}${item.odd ? ` | odd ${Number(item.odd).toFixed(2)}` : ""}`}
                  </span>
                  {item.market}
                </div>
              ))
            ) : (
              <p>{entryMode === "manual" ? "Preencha o confronto e o mercado." : "Envie um print para montar o bilhete."}</p>
            )}
          </div>

          <div className="form-grid compact-grid">
            <label className="field">
              <span>Odd total</span>
              <input required min={1.01} readOnly={entryMode !== "manual"} step={0.01} type="number" value={entryMode === "manual" ? manual.odd : ticketOdd.toFixed(2)} onChange={(event) => setManual({ ...manual, odd: event.target.value })} />
            </label>
            <label className="field">
              <span>Valor apostado</span>
              <input required min={0.01} name="stake" onChange={entryMode === "manual" ? (event) => setManual({ ...manual, stake: event.target.value }) : handleChange} step={0.01} type="number" value={entryMode === "manual" ? manual.stake : form.stake} />
            </label>
            <label className="field">
              <span>Retorno potencial</span>
              <input readOnly type="text" value={formatCurrency(potentialReturn)} />
            </label>
            <label className="field">
              <span>Resultado</span>
              <input readOnly type="text" value="Pendente" />
            </label>
          </div>

          <button className="primary-button" disabled={saving || !selectedMarkets.length} type="submit">
            <Plus size={18} />
            {saving ? "Salvando..." : entryMode === "manual" ? "Salvar tip" : "Salvar bilhete"}
          </button>
        </aside>
      </div>
    </form>
  );
}

function RankingTable({ tipsters, onSelectTipster, summaryTipsters = [] }) {
  const summary = buildRankingSummary(summaryTipsters);
  const summaryItems = [
    ["Banca atual", formatCurrency(summary.bankroll), "strong"],
    ["Lucro", formatCurrency(summary.profit), "strong"],
    ["ROI", `${summary.roi.toFixed(1)}%`, "strong"],
    ["Apostas", summary.tips],
    ["Green", summary.green, "green"],
    ["Red", summary.red, "red"],
    ["Push", summary.push],
    ["Investido", formatCurrency(summary.invested)],
    ["Acerto", `${summary.hitRate.toFixed(1)}%`],
    ["Odd media", summary.averageOdd.toFixed(2)],
    ["Unidades", summary.units.toFixed(2), "strong"],
    ["Stake media", formatCurrency(summary.averageStake)],
  ];

  return (
    <section className="panel table-panel">
      {summaryTipsters.length > 0 && (
        <div className="ranking-summary" aria-label="Resumo pessoal do tipster logado">
          {summaryItems.map(([label, value, tone]) => (
            <div className={`summary-card ${tone ? `summary-${tone}` : ""}`} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tipster</th>
              <th>ROI</th>
              <th>Lucro</th>
              <th>Green</th>
              <th>Red</th>
              <th>Push</th>
              <th>Tips</th>
              <th>Unidades</th>
              <th>Stake média</th>
              <th>Odd média</th>
              <th>Acerto</th>
            </tr>
          </thead>
          <tbody>
            {tipsters.length ? (
              tipsters.map((tipster, index) => (
                <tr key={tipster.id}>
                  <td className="rank-cell">{index + 1}</td>
                  <td>
                    <button
                      className="tipster-link"
                      onClick={() => onSelectTipster(tipster.id)}
                      type="button"
                    >
                      {tipster.name}
                    </button>
                    <span>{tipster.market}</span>
                  </td>
                  <td>{Number(tipster.roi || 0).toFixed(1)}%</td>
                  <td>{formatSignedCurrency(tipster.profit)}</td>
                  <td className="table-green">{tipster.wins || 0}</td>
                  <td className="table-red">{tipster.losses || 0}</td>
                  <td>{tipster.pushes || 0}</td>
                  <td>{tipster.tips}</td>
                  <td>{Number(tipster.units || 0).toFixed(2)}</td>
                  <td>{formatCurrency(tipster.averageStake || 0)}</td>
                  <td>{Number(tipster.averageOdd || 0).toFixed(2)}</td>
                  <td>{Number(tipster.hitRate || 0).toFixed(1)}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-table-cell" colSpan="11">
                  Nenhum tipster real cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatSignedUnits(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}u`;
}

function chartPercent(value, min, max) {
  return clamp(((Number(value) - min) / (max - min)) * 100, 0, 100);
}

function buildTipsterTrend(tips) {
  const byMonth = new Map();

  tips
    .filter((tip) => tip.result !== "pending")
    .forEach((tip) => {
      const key = new Date(tip.placedAt).toISOString().slice(0, 7);
      const current = byMonth.get(key) || 0;
      byMonth.set(key, current + Number(tip.profit ?? profitForTip(tip)));
    });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, profit]) => ({ month, profit }));
}

function buildBankrollSeries(tips) {
  let bankroll = 0;

  return tips
    .filter((tip) => tip.result !== "pending")
    .slice()
    .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt))
    .map((tip) => {
      bankroll += Number(tip.profit ?? profitForTip(tip));
      return {
        id: tip.id,
        bankroll,
        label: formatDateTime(tip.placedAt),
      };
    });
}

function PerformanceBar({ label, value, display, min = 0, max = 100 }) {
  return (
    <div className="chart-row">
      <div>
        <span>{label}</span>
        <strong>{display}</strong>
      </div>
      <div className="chart-track">
        <div style={{ width: `${chartPercent(value, min, max)}%` }} />
      </div>
    </div>
  );
}

function BankrollChart({ points }) {
  if (!points.length) {
    return <p className="empty-chart">Sem apostas resolvidas no período para montar o gráfico da banca.</p>;
  }

  const width = 420;
  const height = 190;
  const padding = 24;
  const values = points.map((point) => point.bankroll);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = Math.max(maxValue - minValue, 1);
  const xFor = (index) =>
    points.length === 1
      ? width / 2
      : padding + (index / (points.length - 1)) * (width - padding * 2);
  const yFor = (value) => height - padding - ((value - minValue) / range) * (height - padding * 2);
  const polyline = points.map((point, index) => `${xFor(index)},${yFor(point.bankroll)}`).join(" ");
  const zeroY = yFor(0);
  const lastPoint = points.at(-1);

  return (
    <div className="bankroll-chart">
      <svg aria-label="Gráfico da banca acumulada" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line className="bankroll-zero" x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} />
        <polyline className="bankroll-line" points={polyline} />
        {points.map((point, index) => (
          <circle className="bankroll-dot" cx={xFor(index)} cy={yFor(point.bankroll)} key={point.id || index} r="4" />
        ))}
      </svg>
      <div className="bankroll-meta">
        <span>{points[0].label}</span>
        <strong>{formatCurrency(lastPoint.bankroll)}</strong>
        <span>{lastPoint.label}</span>
      </div>
    </div>
  );
}

function TipsterDetails({ tipster, tipsterTips, onBack }) {
  const wins = Number(tipster.wins) || 0;
  const settledTips = Number(tipster.settledTips) || 0;
  const losses = Number(tipster.losses) || 0;
  const pushes = Number(tipster.pushes) || 0;
  const pending = Math.max((Number(tipster.tips) || 0) - settledTips, 0);
  const trend = buildTipsterTrend(tipsterTips);
  const bankrollSeries = buildBankrollSeries(tipsterTips);
  const maxTrend = Math.max(...trend.map((item) => Math.abs(item.profit)), 1);

  return (
    <section className="panel detail-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Detalhes do tipster</span>
          <h2>{tipster.name}</h2>
        </div>
        <button className="secondary-button" onClick={onBack} type="button">
          <ArrowLeft size={17} />
          Voltar
        </button>
      </div>

      <div className="detail-grid">
        <div>
          <span>Mercado principal</span>
          <strong>{tipster.market || "-"}</strong>
        </div>
        <div>
          <span>ROI</span>
          <strong>{(Number(tipster.roi) || 0).toFixed(1)}%</strong>
        </div>
        <div>
          <span>Lucro</span>
          <strong>{formatSignedCurrency(tipster.profit)}</strong>
        </div>
        <div>
          <span>Tips</span>
          <strong>{tipster.tips || 0}</strong>
        </div>
        <div>
          <span>Resolvidas</span>
          <strong>{tipster.settledTips || 0}</strong>
        </div>
        <div>
          <span>Acerto</span>
          <strong>{(Number(tipster.hitRate) || 0).toFixed(1)}%</strong>
        </div>
        <div>
          <span>Odd media</span>
          <strong>{(Number(tipster.averageOdd) || 0).toFixed(2)}</strong>
        </div>
        <div>
          <span>Drawdown</span>
          <strong>{formatSignedUnits(Number(tipster.drawdown) * -1)}</strong>
        </div>
      </div>

      <div className="charts-grid">
        <section className="chart-card">
          <div className="chart-heading">
            <span>Performance</span>
            <strong>Indicadores principais</strong>
          </div>
          <PerformanceBar
            display={`${(Number(tipster.roi) || 0).toFixed(1)}%`}
            label="ROI"
            max={25}
            min={-10}
            value={tipster.roi}
          />
          <PerformanceBar
            display={`${(Number(tipster.hitRate) || 0).toFixed(1)}%`}
            label="Acerto"
            value={tipster.hitRate}
          />
          <PerformanceBar
            display={formatSignedUnits(Number(tipster.drawdown) * -1)}
            label="Drawdown"
            max={35}
            value={tipster.drawdown}
          />
        </section>

        <section className="chart-card">
          <div className="chart-heading">
            <span>Resultados</span>
            <strong>Green, red, push e pendente</strong>
          </div>
          <div className="result-bars">
            {[
              ["Green", wins, "green"],
              ["Red", losses, "red"],
              ["Push", pushes, "push"],
              ["Pendente", pending, "pending"],
            ].map(([label, count, tone]) => (
              <div className="result-bar" key={label}>
                <span>{label}</span>
                <div>
                  <i
                    className={`bar-${tone}`}
                    style={{ width: `${chartPercent(count, 0, Math.max(tipster.tips || 1, 1))}%` }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="chart-card trend-card">
          <div className="chart-heading">
            <span>Evolução</span>
            <strong>Lucro por mês</strong>
          </div>
          {trend.length ? (
            <div className="trend-bars">
              {trend.map((item) => (
                <div className="trend-item" key={item.month}>
                  <div
                    className={item.profit >= 0 ? "trend-positive" : "trend-negative"}
                    style={{ height: `${Math.max((Math.abs(item.profit) / maxTrend) * 120, 8)}px` }}
                  />
                  <span>{item.month.slice(5)}</span>
                  <strong>{formatSignedCurrency(item.profit)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-chart">Sem Green, Red ou Push no período para montar evolução.</p>
          )}
        </section>

        <section className="chart-card bankroll-card">
          <div className="chart-heading">
            <span>Banca</span>
            <strong>Evolução da banca no período</strong>
          </div>
          <BankrollChart points={bankrollSeries} />
        </section>
      </div>
    </section>
  );
}

function TicketSelections({ tip }) {
  if (!Array.isArray(tip.ticketSelections) || !tip.ticketSelections.length) {
    return (
      <div className="saved-ticket-list">
        <strong>{tip.event}</strong>
        <span>{tip.pick}</span>
      </div>
    );
  }

  return (
    <div className="saved-ticket-list">
      {tip.ticketSelections.map((selection, index) => (
        <div key={selection.key || `${selection.market}-${index}`}>
          <strong>
            {selection.syntheticMatch
              ? "Bilhete OCR"
              : `${selection.homeTeam || tip.homeTeam || "Mandante"} x ${selection.awayTeam || tip.awayTeam || "Visitante"}`}
          </strong>
          <span>
            {selection.market}
            {selection.odd ? ` | odd ${Number(selection.odd).toFixed(2)}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function TipsTable({
  tips,
  currentUser,
  isAdmin,
  onDelete,
  onResultChange,
  title = "Histórico com data e hora",
}) {
  return (
    <section className="panel tips-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Bilhetes</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Tipster</th>
              <th>Casa</th>
              <th>Bilhete</th>
              <th>Odd</th>
              <th>Valor apostado</th>
              <th>Resultado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tips.map((tip) => (
              <tr className={tip.tipsterId === currentUser?.uid ? "own-row" : ""} key={tip.id}>
                <td>{formatDateTime(tip.placedAt)}</td>
                <td>{tip.tipsterName}</td>
                <td>{tip.bookmaker || "-"}</td>
                <td>
                  <TicketSelections tip={tip} />
                </td>
                <td>{Number(tip.odd).toFixed(2)}</td>
                <td>{formatCurrency(tip.stake)}</td>
                <td>
                  {isAdmin ? (
                    <div className="result-control">
                      <select
                        aria-label={`Alterar resultado de ${tip.pick}`}
                        className={`result-select result-select-${tip.result}`}
                        onChange={(event) => onResultChange(tip, event.target.value)}
                        value={tip.result}
                      >
                        <option value="pending">Pendente</option>
                        <option value="green">Green</option>
                        <option value="red">Red</option>
                        <option value="push">Push</option>
                      </select>
                      {tip.result === "push" && (
                        <label className="push-value-field">
                          <span>Valor do Push</span>
                          <input
                            aria-label={`Valor do Push de ${tip.pick}`}
                            key={`${tip.id}-${tip.pushValue ?? tip.stake ?? 0}`}
                            min="0"
                            onBlur={(event) => onResultChange(tip, "push", event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                            }}
                            step="0.01"
                            type="number"
                            defaultValue={Number(tip.pushValue ?? tip.stake ?? 0)}
                          />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="result-control">
                      <span className={`result result-${tip.result}`}>{resultLabel(tip.result)}</span>
                      {tip.result === "push" && (
                        <small className="push-value-label">Valor: {formatCurrency(tip.pushValue ?? tip.stake)}</small>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {isAdmin && (
                    <button
                      aria-label={`Excluir aposta ${tip.pick}`}
                      className="icon-button"
                      onClick={() => onDelete(tip.id)}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [tips, setTips] = useState([]);
  const [publicRanking, setPublicRanking] = useState([]);
  const [status, setStatus] = useState("Carregando ranking...");
  const [savingTip, setSavingTip] = useState(false);
  const [selectedTipsterId, setSelectedTipsterId] = useState(null);
  const [tipEditorOpen, setTipEditorOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(formatMonthInput(new Date()));
  const [customStart, setCustomStart] = useState(formatDateInput(new Date()));
  const [customEnd, setCustomEnd] = useState(formatDateInput(new Date()));

  const isAdmin = Boolean(authUser?.isAdmin);
  const loggedNick = authUser?.nick?.trim();

  useEffect(() => {
    const unsubscribe = listenToAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;

    if (firebaseEnabled) {
      const unsubscribe = listenToRankings(
        (items) => {
          setPublicRanking(items);
          setStatus(items.length ? "Ranking público sincronizado" : "Nenhum tipster real cadastrado ainda");
        },
        (error) => setStatus(error.message),
      );

      return unsubscribe;
    }

    const unsubscribe = listenToTips(
      (items) => {
        setTips(items);
        setStatus(
          items.length
            ? firebaseEnabled
              ? "Sincronizado com Firestore"
              : "Salvo no navegador"
            : "Nenhum bilhete cadastrado ainda",
        );
      },
      (error) => setStatus(error.message),
    );

    return unsubscribe;
  }, [authReady, authUser]);

  useEffect(() => {
    if (!authReady || !firebaseEnabled || !isAdmin) return undefined;

    const unsubscribe = listenToTips(
      (items) => {
        setTips(items);
        setStatus(items.length ? "Administrador vendo todos os bilhetes" : "Nenhum bilhete cadastrado ainda");
      },
      (error) => setStatus(error.message),
    );

    return unsubscribe;
  }, [authReady, isAdmin]);

  useEffect(() => {
    if (!authReady || !firebaseEnabled || !authUser || isAdmin) return undefined;

    const unsubscribe = listenToUserTips(
      authUser.uid,
      (items) => {
        setTips(items);
        setStatus(items.length ? "Seus bilhetes sincronizados" : "Nenhum bilhete cadastrado ainda");
      },
      (error) => setStatus(error.message),
    );

    return unsubscribe;
  }, [authReady, authUser, isAdmin]);

  const periodRange = useMemo(
    () => getPeriodRange(periodMode, selectedMonth, customStart, customEnd),
    [customEnd, customStart, periodMode, selectedMonth],
  );
  const filteredTips = useMemo(
    () => tips.filter((tip) => isInsidePeriod(tip.placedAt, periodRange)),
    [periodRange, tips],
  );
  const rankedTipsters = useMemo(() => {
    if (firebaseEnabled && !isAdmin) return publicRanking;
    return buildRanking(filteredTips);
  }, [filteredTips, isAdmin, publicRanking]);

  useEffect(() => {
    if (!firebaseEnabled || !isAdmin) return;

    savePublicRankings(buildRanking(tips)).catch((error) => {
      setStatus(`Nao foi possivel atualizar o ranking publico: ${error.message}`);
    });
  }, [isAdmin, tips]);
  const selectedTipster = useMemo(
    () => rankedTipsters.find((tipster) => tipster.id === selectedTipsterId),
    [rankedTipsters, selectedTipsterId],
  );
  const selectedTipsterTips = useMemo(
    () => {
      const privateChartTips = filteredTips.filter((tip) => tip.tipsterId === selectedTipsterId);
      if (privateChartTips.length || isAdmin) return privateChartTips;
      return (selectedTipster?.chartPoints || [])
        .filter((point) => isInsidePeriod(point.placedAt, periodRange))
        .map((point, index) => ({
          id: point.id || `${selectedTipster.id}-chart-${index}`,
          placedAt: point.placedAt,
          profit: Number(point.profit) || 0,
          result: point.result || "green",
        }));
    },
    [filteredTips, isAdmin, periodRange, selectedTipster, selectedTipsterId],
  );
  const orderedTips = useMemo(
    () => [...filteredTips].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt)),
    [filteredTips],
  );
  const privateTips = useMemo(() => {
    if (isAdmin) return orderedTips;
    return orderedTips.filter((tip) => tip.tipsterId === authUser?.uid);
  }, [authUser?.uid, isAdmin, orderedTips]);
  const personalSummaryTipsters = useMemo(() => {
    if (!authUser || isAdmin) return [];
    return buildRanking(privateTips);
  }, [authUser, isAdmin, privateTips]);

  async function handleAuth(mode, form) {
    setLoadingAuth(true);
    setAuthMessage("");

    try {
      if (mode === "reset") {
        await resetPassword(form.email);
        setAuthMessage("Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha. Confira também o spam.");
      } else if (mode === "signup") {
        const user = await signUp(form);
        setAuthUser(user);
        setAuthMessage("Cadastro criado. Você já pode cadastrar suas tips.");
      } else {
        const user = await signIn(form.email, form.password);
        setAuthUser(user);
      }
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setLoadingAuth(false);
    }
  }

  async function handleAddTip(tip) {
    if (!authUser) {
      setStatus("Entre como tipster para cadastrar apostas");
      return;
    }

    const tipsToSave = Array.isArray(tip) ? tip : [tip];

    setSavingTip(true);
    try {
      const savedTips = [];

      for (const item of tipsToSave) {
        const saved = await addTip({
          ...item,
          tipsterId: authUser.uid,
          tipsterName: loggedNick || "Tipster",
        });
        savedTips.push(saved);
      }

      if (!firebaseEnabled) setTips((current) => [...savedTips, ...current]);
      setTipEditorOpen(false);
      setStatus(
        firebaseEnabled
          ? "Bilhete salvo no Firestore"
          : "Bilhete salvo no navegador",
      );
    } catch (error) {
      setStatus(error.message);
      throw error;
    } finally {
      setSavingTip(false);
    }
  }

  async function handleDeleteTip(id) {
    if (!isAdmin) return;

    try {
      await deleteTip(id);
      if (!firebaseEnabled) setTips((current) => current.filter((tip) => tip.id !== id));
      setStatus(firebaseEnabled ? "Aposta excluída pelo administrador" : "Aposta excluída");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleUpdateTipResult(tip, result, pushValueInput = null) {
    if (!isAdmin) return;

    const pushValue = result === "push" ? Number(pushValueInput ?? tip.pushValue ?? tip.stake ?? 0) : null;
    const updatedTip = { ...tip, result, pushValue };
    const profit = profitForTip(updatedTip);
    const updatedAt = new Date().toISOString();

    try {
      await updateTipResult(tip.id, result, profit, pushValue);
      if (!firebaseEnabled) {
        setTips((current) =>
          current.map((item) =>
            item.id === tip.id
              ? {
                  ...item,
                  result,
                  profit,
                  pushValue,
                  resolvedAt: result === "pending" ? null : updatedAt,
                  updatedAt,
                }
              : item,
          ),
        );
      }
      const pushMessage = result === "push" ? ` (${formatCurrency(pushValue)})` : "";
      setStatus(`Resultado atualizado para ${resultLabel(result)}${pushMessage}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  if (!authReady) {
    return (
      <main>
        <div className="loading-panel">Carregando...</div>
      </main>
    );
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <span className="brand-mark">
            <LogoMark />
            Tipster Rank
          </span>
          <div className="site-callout">
            <strong>Onde os melhores se encontram</strong>
            <span>Ranking transparente de tipsters baseado em desempenho e consistência.</span>
          </div>
        </div>
        <div className="header-actions">
          {!authUser && (
            <AuthPanel loading={loadingAuth} message={authMessage} onAuth={handleAuth} />
          )}
          {authUser && (
            <button className="secondary-button" onClick={signOutUser} type="button">
              <LogOut size={17} />
              {loggedNick || "Tipster"} - Sair
            </button>
          )}
        </div>
      </header>

      <section className="period-panel" aria-label="Filtro de periodo">
        <div className="period-controls">
          {[
            ["all", "Todos"],
            ["currentMonth", "Mês atual"],
            ["lastMonth", "Mês passado"],
            ["month", "Escolher mês"],
            ["custom", "Periodo"],
          ].map(([value, label]) => (
            <button
              className={periodMode === value ? "active" : ""}
              key={value}
              onClick={() => setPeriodMode(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {authUser && !tipEditorOpen && !selectedTipster && (
          <button className="primary-button period-tip-button" onClick={() => setTipEditorOpen(true)} type="button">
            <Plus size={18} />
            Cadastrar bilhete
          </button>
        )}
        {periodMode === "month" && (
          <label className="period-field">
            <span>Mês</span>
            <input
              onChange={(event) => setSelectedMonth(event.target.value)}
              type="month"
              value={selectedMonth}
            />
          </label>
        )}
        {periodMode === "custom" && (
          <div className="period-dates">
            <label className="period-field">
              <span>Inicio</span>
              <input
                onChange={(event) => setCustomStart(event.target.value)}
                type="date"
                value={customStart}
              />
            </label>
            <label className="period-field">
              <span>Fim</span>
              <input
                onChange={(event) => setCustomEnd(event.target.value)}
                type="date"
                value={customEnd}
              />
            </label>
          </div>
        )}
      </section>

      <div className={tipEditorOpen && authUser ? "content-grid editor-grid" : "content-grid public-grid"}>
        {tipEditorOpen && authUser ? (
          <TipForm
            tips={tips}
            onCancel={() => setTipEditorOpen(false)}
            onSubmit={handleAddTip}
            saving={savingTip}
          />
        ) : selectedTipster ? (
          <TipsterDetails
            tipster={selectedTipster}
            tipsterTips={selectedTipsterTips}
            onBack={() => setSelectedTipsterId(null)}
          />
        ) : (
          <RankingTable
            summaryTipsters={personalSummaryTipsters}
            tipsters={rankedTipsters}
            onSelectTipster={setSelectedTipsterId}
          />
        )}
        {authUser && !isAdmin && !tipEditorOpen && (
          <TipsTable
            currentUser={authUser}
            isAdmin={false}
            onDelete={handleDeleteTip}
            onResultChange={handleUpdateTipResult}
            title="Meus bilhetes cadastrados"
            tips={privateTips}
          />
        )}
        {isAdmin && (
          <TipsTable
            currentUser={authUser}
            isAdmin={isAdmin}
            onDelete={handleDeleteTip}
            onResultChange={handleUpdateTipResult}
            title="Histórico completo com data e hora"
            tips={privateTips}
          />
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
