import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Tesseract from "tesseract.js";
import {
  ArrowLeft,
  BarChart3,
  CalendarRange,
  Clock3,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  firebaseEnabled,
  listenToAuth,
  signIn,
  signOutUser,
  signUp,
} from "./services/auth";
import { listenToRankings } from "./services/rankings";
import { addTip, clearTips, deleteTip, listenToTips, listenToUserTips } from "./services/tips";
import "./styles.css";

const starterTips = [
  {
    id: "tip-1",
    tipsterId: "demo-ana",
    tipsterName: "Ana Picks",
    market: "Futebol - Match Odds",
    event: "Palmeiras x Santos",
    pick: "Palmeiras vence",
    odd: 1.92,
    stake: 2,
    result: "green",
    profit: 1.84,
    clv: 4.8,
    placedAt: "2026-08-24T14:05:13",
  },
  {
    id: "tip-2",
    tipsterId: "demo-ana",
    tipsterName: "Ana Picks",
    market: "Futebol - Over/Under",
    event: "Flamengo x Vasco",
    pick: "Over 2.5 gols",
    odd: 2.04,
    stake: 1,
    result: "red",
    profit: -1,
    clv: 2.2,
    placedAt: "2026-08-24T15:32:44",
  },
  {
    id: "tip-3",
    tipsterId: "demo-safe",
    tipsterName: "Safe Odds",
    market: "Basquete - Handicap",
    event: "Boston x Miami",
    pick: "Boston -4.5",
    odd: 1.7,
    stake: 2,
    result: "green",
    profit: 1.4,
    clv: 1.7,
    placedAt: "2026-08-24T16:11:08",
  },
  {
    id: "tip-4",
    tipsterId: "demo-valor",
    tipsterName: "ValorBet Pro",
    market: "Futebol - Gols",
    event: "Porto x Benfica",
    pick: "Ambas marcam",
    odd: 2.12,
    stake: 1.5,
    result: "pending",
    profit: 0,
    clv: 5.1,
    placedAt: "2026-08-24T17:03:26",
  },
];

const initialTipForm = {
  bookmaker: "Bet365",
  homeTeam: "",
  awayTeam: "",
  odd: 1.9,
  stake: 1,
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
      staked: 0,
      profit: 0,
      odds: [],
      clvTotal: 0,
      profits: [],
    };

    const profit = Number(tip.profit ?? profitForTip(tip));
    current.tips += 1;
    current.market = tip.market || current.market;
    current.odds.push(Number(tip.odd));
    current.clvTotal += Number(tip.clv) || 0;

    if (tip.result !== "pending") {
      current.settledTips += 1;
      current.staked += Number(tip.stake) || 0;
      current.profit += profit;
      current.profits.push(profit);
      if (tip.result === "green") current.wins += 1;
    }

    byTipster.set(tip.tipsterId, current);
  });

  return Array.from(byTipster.values())
    .map((tipster) => {
      const averageOdd =
        tipster.odds.reduce((total, odd) => total + odd, 0) / Math.max(tipster.odds.length, 1);
      const hitRate = (tipster.wins / Math.max(tipster.settledTips, 1)) * 100;
      const roi = (tipster.profit / Math.max(tipster.staked, 1)) * 100;
      const clv = tipster.clvTotal / Math.max(tipster.tips, 1);
      const drawdown = calculateDrawdown(tipster.profits);
      const score = calculateScore({ ...tipster, averageOdd, hitRate, roi, clv, drawdown });

      return {
        ...tipster,
        averageOdd,
        hitRate,
        roi,
        clv,
        drawdown,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
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
    .replace(/^[@o0]\s+/i, "")
    .replace(/\b(hoje|esta noite)\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .replace(/\br\$\s*[\d.]+,\d{2}\b/gi, "")
    .replace(/\b(superodds|cash out|ganhos potenciais|aposta)\b/gi, "")
    .replace(/[^\p{L}\p{N}\s.,+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTeamName(line) {
  return cleanReceiptLine(line)
    .replace(/\b(he|oe|h|a|x|v|vs)\b/gi, "")
    .replace(/\b\d+[,.]?\d*\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMarketLabel(value) {
  const text = cleanReceiptLine(value)
    .replace(/\b\d{3}\b/g, "")
    .replace(/\s+\d+[,.]\d+$/g, "")
    .replace(/\s+\d$/g, "")
    .replace(/\bo\b/gi, "")
    .trim();
  const normalized = normalizeText(text);
  const lineValue = text.replace(/\b(\d)(\d)\b/g, "$1.$2").replace(/\s+/g, " ");

  if (normalized.includes("mais de")) return lineValue.replace(/mais de/i, "Over").trim();
  if (normalized.includes("menos de")) return lineValue.replace(/menos de/i, "Under").trim();
  return lineValue.trim();
}

function parseReceiptSelections(lines) {
  const selections = [];
  const ignored = /^(multipla|aposta|ganhos potenciais|cash out)/i;
  const startsSelection = (line) =>
    /^@\s+/i.test(line) || (/^[o0]\s+/i.test(line) && /(mais|menos|over|under|ambas)/i.test(line));
  const nextTeamAfter = (items, startIndex) => {
    for (let itemIndex = startIndex; itemIndex < items.length; itemIndex += 1) {
      const team = cleanTeamName(items[itemIndex]);
      if (team) return team;
    }
    return "";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!startsSelection(line)) continue;

    const odd = parseOddFromLine(line);
    const firstLine = normalizeMarketLabel(line);
    const details = [];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (startsSelection(nextLine) || ignored.test(nextLine)) break;
      details.push(nextLine);
    }

    const resultMarketIndex = details.findIndex((item) => normalizeText(item).includes("resultado final"));
    const totalGoalsIndex = details.findIndex((item) => normalizeText(item).includes("total de gols"));
    const isResultMarket = resultMarketIndex >= 0;
    const isTotalGoals = totalGoalsIndex >= 0;
    const usableDetails = details.map(cleanTeamName).filter(Boolean);
    let group = "Personalizado";
    let market = firstLine;
    let homeTeam = "";
    let awayTeam = "";

    if (isResultMarket) {
      group = "Resultado";
      market = `${firstLine} vence`;
      homeTeam = nextTeamAfter(details, resultMarketIndex + 1) || firstLine;
      awayTeam = nextTeamAfter(details, resultMarketIndex + 2);
    } else if (isTotalGoals) {
      group = "Gols";
      market = `${firstLine} Total de Gols`;
      homeTeam = nextTeamAfter(details, totalGoalsIndex + 1);
      awayTeam = nextTeamAfter(details, totalGoalsIndex + 2);
    } else {
      const teams = usableDetails.filter((item) => !normalizeText(item).includes("resultado final"));
      homeTeam = teams[0] || "";
      awayTeam = teams[1] || "";
    }

    if (market && homeTeam && awayTeam) {
      selections.push({
        key: `${group}:${market}:${homeTeam}:${awayTeam}:${odd || ""}`,
        group,
        market,
        homeTeam,
        awayTeam,
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
  const stake = lines.map(parseMoney).find((value) => value && value > 0);

  return {
    bookmaker,
    homeTeam: receiptSelections[0]?.homeTeam || matchParts?.[0] || "",
    awayTeam: receiptSelections[0]?.awayTeam || matchParts?.[1] || "",
    odd: receiptSelections[0]?.odd || oddCandidates.at(-1),
    stake,
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

          <label className="field field-full">
            <span>Senha</span>
            <input
              minLength={6}
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={form.password}
            />
          </label>

          {message && <p className="form-message">{message}</p>}

          <button className="primary-button" disabled={loading} type="submit">
            <Lock size={18} />
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar cadastro"}
          </button>
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

function TipForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(initialTipForm);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
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
      setOcrStatus(text ? "Texto transcrito. Confira antes de salvar." : "Nao consegui ler texto nessa imagem.");
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

  const ticketOdd = selectedMarkets
    .map((item) => Number(item.odd))
    .filter((odd) => odd >= 1.01)
    .reduce((total, odd) => total * odd, selectedMarkets.some((item) => Number(item.odd) >= 1.01) ? 1 : Number(form.odd) || 1);
  const potentialReturn = Number(form.stake || 0) * ticketOdd;

  async function handleSubmit(event) {
    event.preventDefault();
    const hasGlobalMatch = form.homeTeam.trim() && form.awayTeam.trim();
    const hasReceiptMatches = selectedMarkets.every((item) => item.homeTeam && item.awayTeam);
    if ((!hasGlobalMatch && !hasReceiptMatches) || !selectedMarkets.length) return;

    const placedAt = new Date().toISOString();
    const firstSelection = selectedMarkets[0];
    const homeTeam = firstSelection.homeTeam || form.homeTeam.trim();
    const awayTeam = firstSelection.awayTeam || form.awayTeam.trim();
    const ticketData = {
      ...form,
      odd: ticketOdd,
      event:
        selectedMarkets.length > 1
          ? `Multipla de ${selectedMarkets.length} selecoes`
          : `${homeTeam} x ${awayTeam}`,
      market: selectedMarkets.length > 1 ? "Bilhete multiplo" : firstSelection.group,
      pick:
        selectedMarkets.length > 1
          ? selectedMarkets.map((item) => item.market).join(" / ")
          : firstSelection.market,
      homeTeam,
      awayTeam,
      bookmaker: form.bookmaker.trim(),
      ticketOdd,
      ticketSelections: selectedMarkets,
      potentialReturn,
      receiptText: receiptText.trim(),
      source: receiptText.trim() ? "ocr" : "manual",
      placedAt,
    };
    const tipsToSave = [{ ...ticketData, profit: profitForTip(ticketData) }];

    try {
      await onSubmit(tipsToSave);
      setForm(initialTipForm);
      setSelectedMarkets([]);
    } catch {
      // A mensagem de erro ja e tratada no componente principal.
    }
  }

  return (
    <form className="panel form-panel tip-workspace" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Novo bilhete</span>
          <h2>Transcrever e salvar bilhete</h2>
        </div>
        <button className="secondary-button" onClick={onCancel} type="button">
          <ArrowLeft size={17} />
          Voltar
        </button>
      </div>

      <div className="ticket-layout">
        <div className="ticket-main">
          <section className="receipt-reader" onPaste={handlePaste}>
            <div>
              <span className="eyebrow">Print da aposta</span>
              <strong>Enviar foto ou colar print</strong>
              <small>O sistema usa OCR gratuito no navegador para transcrever o bilhete.</small>
            </div>
            <label className="upload-box">
              <input accept="image/*" onChange={handleImageChange} type="file" />
              <Plus size={18} />
              Escolher imagem
            </label>
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
          </section>

          <div className="form-grid match-grid">
            <label className="field">
              <span>Casa de apostas</span>
              <select name="bookmaker" onChange={handleChange} value={form.bookmaker}>
                {bookmakers.map((bookmaker) => (
                  <option key={bookmaker} value={bookmaker}>
                    {bookmaker}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Mandante</span>
              <input
                name="homeTeam"
                onChange={handleChange}
                placeholder="Ex.: Corinthians"
                required
                type="text"
                value={form.homeTeam}
              />
            </label>
            <label className="field">
              <span>Visitante</span>
              <input
                name="awayTeam"
                onChange={handleChange}
                placeholder="Ex.: Sao Paulo"
                required
                type="text"
                value={form.awayTeam}
              />
            </label>
          </div>

        </div>

        <aside className="ticket-summary">
          <span className="eyebrow">Bilhete</span>
          <strong>
            {form.homeTeam || "Mandante"} x {form.awayTeam || "Visitante"}
          </strong>
          <small>{form.bookmaker}</small>

          <div className="selected-markets">
            {selectedMarkets.length ? (
              selectedMarkets.map((item) => (
                <div className="selected-ticket-item" key={item.key}>
                  <span>
                    {item.homeTeam && item.awayTeam
                      ? `${item.homeTeam} x ${item.awayTeam}${item.odd ? ` | odd ${Number(item.odd).toFixed(2)}` : ""}`
                      : item.group}
                  </span>
                  {item.market}
                </div>
              ))
            ) : (
              <p>Envie um print para montar o bilhete.</p>
            )}
          </div>

          <div className="form-grid compact-grid">
            <label className="field">
              <span>Odd total</span>
              <input min={1.01} readOnly step={0.01} type="number" value={ticketOdd.toFixed(2)} />
            </label>
            <label className="field">
              <span>Stake</span>
              <input min={0.01} name="stake" onChange={handleChange} step={0.01} type="number" value={form.stake} />
            </label>
            <label className="field">
              <span>Retorno potencial</span>
              <input readOnly type="text" value={formatCurrency(potentialReturn)} />
            </label>
            <label className="field">
              <span>Resultado</span>
              <select name="result" onChange={handleChange} value={form.result}>
                <option value="pending">Pendente</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
              </select>
            </label>
          </div>

          <button className="primary-button" disabled={saving || !selectedMarkets.length} type="submit">
            <Plus size={18} />
            {saving ? "Salvando..." : "Salvar bilhete"}
          </button>
        </aside>
      </div>
    </form>
  );
}

function RankingTable({ tipsters, onSelectTipster }) {
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Ranking ativo</span>
          <h2>Score por apostas cadastradas</h2>
        </div>
        <BarChart3 size={22} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tipster</th>
              <th>Score</th>
              <th>ROI</th>
              <th>Lucro</th>
              <th>Tips</th>
              <th>Acerto</th>
            </tr>
          </thead>
          <tbody>
            {tipsters.map((tipster, index) => (
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
                <td>
                  <div className="score-pill">{tipster.score}</div>
                </td>
                <td>{tipster.roi.toFixed(1)}%</td>
                <td>{tipster.profit > 0 ? "+" : ""}{tipster.profit.toFixed(2)}u</td>
                <td>{tipster.tips}</td>
                <td>{tipster.hitRate.toFixed(1)}%</td>
              </tr>
            ))}
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

function TipsterDetails({ tipster, tipsterTips, onBack }) {
  const wins = Number(tipster.wins) || 0;
  const settledTips = Number(tipster.settledTips) || 0;
  const losses = Math.max(settledTips - wins, 0);
  const pending = Math.max((Number(tipster.tips) || 0) - settledTips, 0);
  const trend = buildTipsterTrend(tipsterTips);
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

      <div className="detail-hero">
        <div>
          <span>Score</span>
          <strong>{tipster.score || 0}</strong>
        </div>
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
          <strong>{formatSignedUnits(tipster.profit)}</strong>
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
          <span>CLV medio</span>
          <strong>{(Number(tipster.clv) || 0).toFixed(1)}%</strong>
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
            display={`${(Number(tipster.clv) || 0).toFixed(1)}%`}
            label="CLV"
            max={12}
            min={-5}
            value={tipster.clv}
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
            <strong>Green, red e pendente</strong>
          </div>
          <div className="result-bars">
            {[
              ["Green", wins, "green"],
              ["Red", losses, "red"],
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
            <span>Evolucao</span>
            <strong>Lucro por mes</strong>
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
                  <strong>{formatSignedUnits(item.profit)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-chart">Sem apostas resolvidas disponiveis para montar evolucao.</p>
          )}
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
            {selection.homeTeam || tip.homeTeam || "Mandante"} x{" "}
            {selection.awayTeam || tip.awayTeam || "Visitante"}
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
  onClear,
  onDelete,
  title = "Historico com data e hora",
}) {
  return (
    <section className="panel tips-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Bilhetes</span>
          <h2>{title}</h2>
        </div>
        <div className="panel-actions">
          {isAdmin && tips.length > 0 && (
            <button className="secondary-button danger-button" onClick={onClear} type="button">
              <Trash2 size={17} />
              Limpar bilhetes
            </button>
          )}
          <Clock3 size={22} />
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
              <th>Stake</th>
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
                  <span className={`result result-${tip.result}`}>{tip.result}</span>
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

  const adminEmails = useMemo(
    () =>
      (import.meta.env.VITE_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    [],
  );
  const isAdmin = authUser?.email && adminEmails.includes(authUser.email.toLowerCase());
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
          setPublicRanking(items.length ? items : buildRanking(starterTips));
          setStatus(items.length ? "Ranking publico sincronizado" : "Usando dados exemplo");
        },
        (error) => setStatus(error.message),
      );

      return unsubscribe;
    }

    const unsubscribe = listenToTips(
      (items) => {
        setTips(items.length ? items : authUser ? [] : starterTips);
        setStatus(
          items.length
            ? firebaseEnabled
              ? "Sincronizado com Firestore"
              : "Salvo no navegador"
            : authUser
              ? "Nenhum bilhete cadastrado ainda"
              : "Usando dados exemplo",
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
  const selectedTipster = useMemo(
    () => rankedTipsters.find((tipster) => tipster.id === selectedTipsterId),
    [rankedTipsters, selectedTipsterId],
  );
  const selectedTipsterTips = useMemo(
    () => filteredTips.filter((tip) => tip.tipsterId === selectedTipsterId),
    [filteredTips, selectedTipsterId],
  );
  const orderedTips = useMemo(
    () => [...filteredTips].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt)),
    [filteredTips],
  );
  const privateTips = useMemo(() => {
    if (isAdmin) return orderedTips;
    return orderedTips.filter((tip) => tip.tipsterId === authUser?.uid);
  }, [authUser?.uid, isAdmin, orderedTips]);

  async function handleAuth(mode, form) {
    setLoadingAuth(true);
    setAuthMessage("");

    try {
      if (mode === "signup") {
        const user = await signUp(form);
        setAuthUser(user);
        setAuthMessage("Cadastro criado. Voce ja pode cadastrar suas tips.");
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
      setStatus(firebaseEnabled ? "Aposta excluida pelo administrador" : "Aposta excluida");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleClearTips() {
    if (!isAdmin) return;

    try {
      await clearTips();
      setTips([]);
      setStatus(firebaseEnabled ? "Todos os bilhetes foram apagados do Firestore" : "Todos os bilhetes foram apagados");
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
            <Sparkles size={18} />
            Tipster Rank
          </span>
          <div className="site-callout">
            <strong>Onde os melhores se encontram</strong>
            <span>Ranking transparente de tipsters baseado em desempenho e consistencia.</span>
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
        <div className="period-title">
          <CalendarRange size={18} />
          <span>Periodo do ranking</span>
        </div>
        <div className="period-controls">
          {[
            ["all", "Todos"],
            ["currentMonth", "Mes atual"],
            ["lastMonth", "Mes passado"],
            ["month", "Escolher mes"],
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
        {periodMode === "month" && (
          <label className="period-field">
            <span>Mes</span>
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

      <div className={authUser ? "content-grid" : "content-grid public-grid"}>
        {tipEditorOpen && authUser && !isAdmin ? (
          <TipForm
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
          <RankingTable tipsters={rankedTipsters} onSelectTipster={setSelectedTipsterId} />
        )}
        {authUser && !isAdmin && !tipEditorOpen && !selectedTipster && (
          <TipLauncher onOpen={() => setTipEditorOpen(true)} />
        )}
        {authUser && !isAdmin && !tipEditorOpen && (
          <TipsTable
            currentUser={authUser}
            isAdmin={false}
            onClear={handleClearTips}
            onDelete={handleDeleteTip}
            title="Meus bilhetes cadastrados"
            tips={privateTips}
          />
        )}
        {isAdmin && (
          <TipsTable
            currentUser={authUser}
            isAdmin={isAdmin}
            onClear={handleClearTips}
            onDelete={handleDeleteTip}
            title="Historico completo com data e hora"
            tips={privateTips}
          />
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
