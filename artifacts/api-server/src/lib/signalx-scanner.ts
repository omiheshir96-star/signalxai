import { and, desc, eq, gte } from "drizzle-orm";
import { db, signalxSignalsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
];
const BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines";
const TWO_MINUTES_MS = 2 * 60 * 1000;
const SIGNAL_COOLDOWN_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

function integerSetting(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const minScore = Math.min(
  96,
  integerSetting(process.env.MIN_SCORE, 75),
);
const scanSeconds = integerSetting(process.env.SCAN_SECONDS, 60);
const configuredSymbols = (process.env.SYMBOLS ?? DEFAULT_SYMBOLS.join(","))
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter((symbol) => /^[A-Z0-9]{2,16}USDT$/.test(symbol));
const symbols = configuredSymbols.length ? configuredSymbols : DEFAULT_SYMBOLS;

export const scannerConfig = {
  minScore,
  scanSeconds,
  timeframe: "2m",
  symbols,
  telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
};

export interface ScannerStatus {
  running: boolean;
  scanInProgress: boolean;
  lastScan: string | null;
  lastError: string | null;
}

const status: ScannerStatus = {
  running: true,
  scanInProgress: false,
  lastScan: null,
  lastError: null,
};

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SignalCandidate {
  side: "BUY" | "SELL";
  confidence: number;
  price: number;
  rsi: number;
  volatility: number;
  reasons: string[];
}

interface BinanceKline {
  0: number;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
}

function ema(values: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const result: number[] = [];
  let current = values[0] ?? 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    current = index === 0 ? value : alpha * value + (1 - alpha) * current;
    result.push(current);
  }

  return result;
}

function wilderAverage(values: number[], period: number): number[] {
  const alpha = 1 / period;
  const result: number[] = [];
  let current = values[0] ?? 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    current = index === 0 ? value : alpha * value + (1 - alpha) * current;
    result.push(current);
  }

  return result;
}

async function fetchCandles(symbol: string): Promise<Candle[]> {
  const url = new URL(BINANCE_KLINES_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1m");
  url.searchParams.set("limit", "300");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Binance returned HTTP ${response.status}`);
  }

  const rows = (await response.json()) as BinanceKline[];
  const grouped = new Map<number, Candle>();

  for (const row of rows) {
    const bucket = Math.floor(Number(row[0]) / TWO_MINUTES_MS) * TWO_MINUTES_MS;
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    const current = grouped.get(bucket);

    if (current) {
      current.high = Math.max(current.high, high);
      current.low = Math.min(current.low, low);
      current.close = close;
      current.volume += volume;
    } else {
      grouped.set(bucket, { timestamp: bucket, open, high, low, close, volume });
    }
  }

  return Array.from(grouped.values()).sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

function analyzeCandles(candles: Candle[]): SignalCandidate | null {
  if (candles.length < 100) return null;

  const closes = candles.map((candle) => candle.close);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12.map((value, index) => value - ema26[index]!);
  const macdSignal = ema(macd, 9);
  const changes = closes.slice(1).map((value, index) => value - closes[index]!);
  const averageGains = wilderAverage(
    changes.map((value) => Math.max(0, value)),
    14,
  );
  const averageLosses = wilderAverage(
    changes.map((value) => Math.max(0, -value)),
    14,
  );
  const rsiValues = averageGains.map((gain, index) => {
    const loss = averageLosses[index]!;
    return loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  });

  const trueRanges = candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close;
    if (previousClose === undefined) return candle.high - candle.low;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  const atrValues = wilderAverage(trueRanges, 14);
  const lastIndex = candles.length - 1;
  const previousIndex = lastIndex - 1;
  const current = candles[lastIndex]!;
  const previousMacd = macd[previousIndex]!;
  const currentRsi = rsiValues[rsiValues.length - 1]!;
  const currentAtr = atrValues[lastIndex]!;
  const volumeWindow = candles.slice(-20);
  const averageVolume =
    volumeWindow.reduce((total, candle) => total + candle.volume, 0) /
    volumeWindow.length;

  let bullishScore = 0;
  let bearishScore = 0;
  const bullishReasons: string[] = [];
  const bearishReasons: string[] = [];

  if (ema9[lastIndex]! > ema21[lastIndex]! && ema21[lastIndex]! > ema50[lastIndex]!) {
    bullishScore += 2;
    bullishReasons.push("EMA trend bullish");
  }
  if (ema9[lastIndex]! < ema21[lastIndex]! && ema21[lastIndex]! < ema50[lastIndex]!) {
    bearishScore += 2;
    bearishReasons.push("EMA trend bearish");
  }
  if (
    macd[lastIndex]! > macdSignal[lastIndex]! &&
    macd[lastIndex]! - previousMacd > 0
  ) {
    bullishScore += 2;
    bullishReasons.push("MACD bullish");
  }
  if (
    macd[lastIndex]! < macdSignal[lastIndex]! &&
    macd[lastIndex]! - previousMacd < 0
  ) {
    bearishScore += 2;
    bearishReasons.push("MACD bearish");
  }
  if (currentRsi >= 52 && currentRsi <= 68) {
    bullishScore += 1;
    bullishReasons.push("RSI bullish zone");
  }
  if (currentRsi >= 32 && currentRsi <= 48) {
    bearishScore += 1;
    bearishReasons.push("RSI bearish zone");
  }
  if (currentRsi > 72) bullishScore -= 2;
  if (currentRsi < 28) bearishScore -= 2;
  if (current.volume > averageVolume * 1.05) {
    if (current.close > current.open) {
      bullishScore += 1;
      bullishReasons.push("Volume confirmation");
    }
    if (current.close < current.open) {
      bearishScore += 1;
      bearishReasons.push("Volume confirmation");
    }
  }

  let side: "BUY" | "SELL";
  let score: number;
  let reasons: string[];
  if (bullishScore >= 6 && bullishScore >= bearishScore + 3) {
    side = "BUY";
    score = bullishScore;
    reasons = bullishReasons;
  } else if (bearishScore >= 6 && bearishScore >= bullishScore + 3) {
    side = "SELL";
    score = bearishScore;
    reasons = bearishReasons;
  } else {
    return null;
  }

  const volatility = (currentAtr / current.close) * 100;
  if (!Number.isFinite(volatility) || volatility < 0.01 || volatility > 1.5) {
    return null;
  }

  return {
    side,
    confidence: Math.min(96, 55 + score * 6),
    price: current.close,
    rsi: currentRsi,
    volatility,
    reasons: reasons.slice(0, 4),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown scanner error";
}

async function shouldSaveSignal(
  symbol: string,
  side: "BUY" | "SELL",
): Promise<boolean> {
  const cooldownStart = new Date(Date.now() - SIGNAL_COOLDOWN_MS);
  const existing = await db
    .select({ id: signalxSignalsTable.id })
    .from(signalxSignalsTable)
    .where(
      and(
        eq(signalxSignalsTable.symbol, symbol),
        eq(signalxSignalsTable.side, side),
        gte(signalxSignalsTable.createdAt, cooldownStart),
      ),
    )
    .limit(1);
  return existing.length === 0;
}

async function sendTelegramAlert(signal: {
  symbol: string;
  side: "BUY" | "SELL";
  confidence: number;
  price: number;
  rsi: number;
  volatility: number;
  reasons: string[];
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;

  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "@SignalXAI_Signals";
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: [
          "SIGNALX AI",
          "",
          `${signal.side} — ${signal.symbol}`,
          `Confidence: ${signal.confidence}%`,
          `Price: ${signal.price.toPrecision(8)}`,
          `RSI: ${signal.rsi.toFixed(1)}`,
          `Volatility: ${signal.volatility.toFixed(3)}%`,
          "",
          "Confirmations:",
          ...signal.reasons.map((reason) => `• ${reason}`),
          "",
          "Educational signal only. No guaranteed profit.",
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Telegram returned HTTP ${response.status}`);
  }
}

async function scanSymbol(symbol: string): Promise<void> {
  const candidate = analyzeCandles(await fetchCandles(symbol));
  if (!candidate || candidate.confidence < scannerConfig.minScore) return;
  if (!(await shouldSaveSignal(symbol, candidate.side))) return;

  await db.insert(signalxSignalsTable).values({
    symbol,
    side: candidate.side,
    confidence: candidate.confidence,
    price: candidate.price,
    rsi: candidate.rsi,
    volatility: candidate.volatility,
    reasons: candidate.reasons.join(" | "),
    result: "PENDING",
  });

  try {
    await sendTelegramAlert({ symbol, ...candidate });
  } catch (error) {
    logger.warn(
      { symbol, err: errorMessage(error) },
      "Signal saved, but Telegram notification failed",
    );
  }
}

let activeScan: Promise<void> | null = null;

export function getScannerStatus(): ScannerStatus {
  return { ...status };
}

export function startSignalxScan(): boolean {
  if (activeScan) return false;

  status.scanInProgress = true;
  status.lastError = null;
  activeScan = (async () => {
    const errors: string[] = [];
    let nextSymbolIndex = 0;
    const workerCount = Math.min(3, symbols.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextSymbolIndex < symbols.length) {
          const symbol = symbols[nextSymbolIndex++]!;
          try {
            await scanSymbol(symbol);
          } catch (error) {
            const message = errorMessage(error);
            errors.push(`${symbol}: ${message}`);
            logger.warn({ symbol, err: message }, "Market scan failed");
          }
        }
      }),
    );

    status.lastScan = new Date().toISOString();
    status.lastError =
      errors.length === 0
        ? null
        : `${errors.length} market${errors.length === 1 ? "" : "s"} failed: ${errors
            .slice(0, 3)
            .join("; ")}`;
  })()
    .catch((error: unknown) => {
      status.lastError = errorMessage(error);
      logger.error({ err: error }, "SignalX scan failed");
    })
    .finally(() => {
      status.scanInProgress = false;
      activeScan = null;
    });

  return true;
}

export function startSignalxScanner(): void {
  if (status.running === false) return;
  startSignalxScan();
  setInterval(() => {
    startSignalxScan();
  }, scannerConfig.scanSeconds * 1000);
}

export async function getRecentSignalxSignals() {
  return db
    .select()
    .from(signalxSignalsTable)
    .orderBy(desc(signalxSignalsTable.createdAt))
    .limit(20);
}