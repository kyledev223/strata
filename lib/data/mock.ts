/**
 * Deterministic mock data. Every token's history is produced by running a
 * seeded sequence of buys, sells and redemptions through the same floor math
 * the UI uses (lib/floor.ts), so prices, floors and reserves stay consistent.
 */
import {
  curveInventory,
  effectivePrice,
  floorOf,
  freshPool,
  quoteBuy,
  quoteExit,
  type LaunchSettings,
  type PoolState,
} from "@/lib/floor";
import type {
  Holding,
  PricePoint,
  ProtocolStats,
  StrataDataSource,
  TokenActivity,
  TokenDetail,
  TokenQuery,
  TokenSummary,
} from "./types";

const HOUR = 3_600_000;
// Rounded to the hour so server and client agree on ages within a render.
const NOW = Math.floor(Date.now() / HOUR) * HOUR;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function address(r: () => number, len = 44) {
  let s = "";
  for (let i = 0; i < len; i++) s += B58[Math.floor(r() * B58.length)];
  return s;
}

interface Seed {
  name: string;
  ticker: string;
  description: string;
  ageHours: number;
  /** Buy pressure early and late in life (0..1). */
  mood: [number, number];
  settings: LaunchSettings;
  trades: number;
}

const S = (reserve: number, fee: number, creator: number, vest: number | null = null, delay = 0): LaunchSettings => ({
  reserveShareBps: reserve * 100,
  feeToReserveBps: fee * 100,
  creatorFeeBps: creator * 100,
  vestingDays: vest,
  redemptionDelayHours: delay,
});

const SEEDS: Seed[] = [
  { name: "Basalt", ticker: "BSLT", description: "Slow rock for slow money. Half of every buy goes under the floor.", ageHours: 410, mood: [0.7, 0.55], settings: S(50, 1, 0.5, 30), trades: 420 },
  { name: "Cairn", ticker: "CAIRN", description: "A pile of stones that marks the way. Each holder adds one.", ageHours: 260, mood: [0.75, 0.45], settings: S(30, 1, 0.5), trades: 360 },
  { name: "Lodestone", ticker: "LODE", description: "Points north, mostly.", ageHours: 190, mood: [0.8, 0.6], settings: S(25, 0.75, 1, 14), trades: 380 },
  { name: "Quarry Cat", ticker: "QCAT", description: "Lives in the quarry. Eats the dust.", ageHours: 96, mood: [0.85, 0.3], settings: S(20, 1, 1), trades: 300 },
  { name: "Moss Ledger", ticker: "MOSS", description: "A community treasury that grows like moss: slowly, on every surface.", ageHours: 520, mood: [0.62, 0.6], settings: S(40, 1.5, 0.25, 60, 24), trades: 450 },
  { name: "Obelisk", ticker: "OBLK", description: "Tall, narrow, unbothered.", ageHours: 72, mood: [0.9, 0.5], settings: S(15, 0.5, 1), trades: 260 },
  { name: "Flint", ticker: "FLNT", description: "Strike it twice.", ageHours: 40, mood: [0.8, 0.25], settings: S(20, 1, 0.5), trades: 200 },
  { name: "Shale Dog", ticker: "SHALE", description: "Good boy, layered.", ageHours: 150, mood: [0.78, 0.35], settings: S(25, 1, 1), trades: 320 },
  { name: "Travertine", ticker: "TRAV", description: "Deposited by hot springs, one thin layer at a time.", ageHours: 330, mood: [0.66, 0.62], settings: S(35, 1.25, 0.5, 30), trades: 400 },
  { name: "Scree", ticker: "SCREE", description: "Loose stones at the bottom of the slope. Still worth the floor.", ageHours: 22, mood: [0.72, 0.2], settings: S(30, 1, 0.5), trades: 170 },
  { name: "Mica Moth", ticker: "MICA", description: "Wings that split into sheets.", ageHours: 12, mood: [0.88, 0.7], settings: S(20, 1, 1, 7), trades: 140 },
  { name: "Gneiss Guy", ticker: "GNEISS", description: "Pronounced nice.", ageHours: 210, mood: [0.7, 0.5], settings: S(25, 1, 0.5), trades: 300 },
  { name: "Loess", ticker: "LOESS", description: "Wind-blown silt. Fertile ground for patient holders.", ageHours: 600, mood: [0.6, 0.55], settings: S(45, 2, 0), trades: 480 },
  { name: "Tuff", ticker: "TUFF", description: "Volcanic ash, compressed. It's tuff.", ageHours: 55, mood: [0.82, 0.4], settings: S(20, 0.5, 1.5), trades: 230 },
  { name: "Chert", ticker: "CHERT", description: "Sharp edges, steady floor.", ageHours: 120, mood: [0.7, 0.6], settings: S(30, 1, 0.5, null, 6), trades: 280 },
  { name: "Feldspar", ticker: "FELD", description: "Most of the crust is made of this. Most of our reserve too.", ageHours: 300, mood: [0.68, 0.52], settings: S(40, 1, 0.5), trades: 380 },
  { name: "Marl", ticker: "MARL", description: "Lime mud. Holds water and value.", ageHours: 6, mood: [0.9, 0.85], settings: S(25, 1, 1), trades: 90 },
  { name: "Tidewrack", ticker: "WRACK", description: "Whatever the tide leaves on the stones.", ageHours: 170, mood: [0.75, 0.15], settings: S(20, 1, 0.5), trades: 310 },
];

interface Sim {
  summary: TokenSummary;
  detail: TokenDetail;
  redeemedTokens: number;
  redeemedSol: number;
  feesToReserve: number;
  floorRaises: number;
}

function simulate(seed: Seed, index: number): Sim {
  const r = rng(0x5eed + index * 7919);
  const mint = address(r);
  const creator = address(r);
  const createdAt = NOW - seed.ageHours * HOUR;

  let pool: PoolState = freshPool(seed.settings);
  const history: PricePoint[] = [];
  const activity: TokenActivity[] = [];
  const buyers = new Set<number>();
  let redeemedTokens = 0;
  let redeemedSol = 0;
  let feesToReserve = 0;
  let floorRaises = 0;
  let volume24h = 0;
  let price24hAgo = effectivePrice(pool);
  const span = seed.ageHours * HOUR;

  for (let i = 0; i < seed.trades; i++) {
    const p = i / seed.trades;
    const t = createdAt + Math.round(span * Math.pow(p, 0.85));
    // Buy pressure eases from the early mood to the late mood, with some noise.
    const buyBias = seed.mood[0] + (seed.mood[1] - seed.mood[0]) * p + (r() - 0.5) * 0.25;
    const before = floorOf(pool);
    const wallet = Math.floor(r() * (40 + seed.trades));
    let kind: TokenActivity["kind"];
    let sol = 0;
    let tokens = 0;

    const wantsSell = pool.circulating >= 1 && r() >= buyBias;
    const sellSize = pool.circulating * (0.001 + r() * 0.012);
    const redemptionOpen = seed.settings.redemptionDelayHours * HOUR < t - createdAt;
    const exit = wantsSell ? quoteExit(pool, sellSize, redemptionOpen) : null;
    // While redemption is still closed, a seller who would be routed to it waits; we buy instead.
    const sellBlocked = exit?.blocked ?? false;

    if (!exit || sellBlocked) {
      sol = Math.max(0.05, -Math.log(1 - r()) * (0.6 + 2.2 * r()));
      const q = quoteBuy(pool, sol);
      pool = q.after;
      feesToReserve += q.reserveFee;
      tokens = q.tokensOut;
      kind = "buy";
      buyers.add(wallet);
    } else {
      pool = exit.after;
      feesToReserve += exit.reserveFee;
      redeemedTokens += exit.toRedeem;
      redeemedSol += exit.solFromRedeem;
      tokens = exit.tokensIn;
      sol = exit.solOut;
      kind = exit.toRedeem > exit.toCurve ? "redeem" : "sell";
    }
    if (floorOf(pool) > before * (1 + 1e-9) && before > 0) floorRaises++;
    if (t >= NOW - 24 * HOUR) volume24h += sol;
    else price24hAgo = effectivePrice(pool);

    if (i % Math.max(1, Math.floor(seed.trades / 96)) === 0 || i === seed.trades - 1) {
      history.push({ t, price: effectivePrice(pool), floor: floorOf(pool) });
    }
    if (i >= seed.trades - 14) activity.unshift({ kind, wallet: address(rng(wallet + index * 101)), sol, tokens, t });
  }

  const priceSol = effectivePrice(pool);
  const step = Math.max(1, Math.floor(history.length / 32));
  const sparkPts = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  const summary: TokenSummary = {
    mint,
    name: seed.name,
    ticker: seed.ticker,
    creator,
    description: seed.description,
    createdAt,
    status: curveInventory(pool) <= 0 ? "complete" : "curve",
    priceSol,
    floorSol: floorOf(pool),
    reserveSol: pool.reserveSol,
    circulating: pool.circulating,
    volume24hSol: volume24h,
    change24h: price24hAgo > 0 ? priceSol / price24hAgo - 1 : 0,
    holders: Math.round(buyers.size * 1.6),
    settings: seed.settings,
    curve: { virtualSol: pool.virtualSol, virtualTokens: pool.virtualTokens },
    spark: sparkPts.map((h) => h.price),
    floorSpark: sparkPts.map((h) => h.floor),
    hue: Math.floor(r() * 360),
  };

  return {
    summary,
    detail: { ...summary, history, floorRaises, redeemedTokens, feesToReserveSol: feesToReserve, activity },
    redeemedTokens,
    redeemedSol,
    feesToReserve,
    floorRaises,
  };
}

let cache: Sim[] | null = null;
function sims(): Sim[] {
  return (cache ??= SEEDS.map(simulate));
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const mockDataSource: StrataDataSource = {
  async getProtocolStats(): Promise<ProtocolStats> {
    await delay(0);
    const all = sims();
    const sum = (f: (s: Sim) => number) => all.reduce((a, s) => a + f(s), 0);
    // The listed tokens plus a fixed long tail of older, quieter launches.
    return {
      now: {
        launches: 412,
        reserveSol: sum((s) => s.summary.reserveSol) + 3_184.6,
        volume24hSol: sum((s) => s.summary.volume24hSol) + 912.4,
      },
      allTime: {
        floorRaises: sum((s) => s.floorRaises) + 61_208,
        redeemedBurnedTokens: sum((s) => s.redeemedTokens) + 418_500_000,
        redeemedSol: sum((s) => s.redeemedSol) + 702.3,
        feesToReserveSol: sum((s) => s.feesToReserve) + 1_406.9,
      },
      asOf: NOW,
    };
  },

  async listTokens(query: TokenQuery = {}) {
    await delay(0);
    const q = query.search?.trim().toLowerCase();
    let tokens = sims().map((s) => s.summary);
    if (query.status && query.status !== "all") tokens = tokens.filter((t) => t.status === query.status);
    if (q) tokens = tokens.filter((t) => [t.name, t.ticker, t.mint].some((v) => v.toLowerCase().includes(q)));
    return { tokens: sortTokens(tokens, query.sort ?? "reserve"), asOf: NOW };
  },

  async getToken(mint: string) {
    await delay(0);
    return sims().find((s) => s.summary.mint === mint)?.detail ?? null;
  },

  async getHoldings(_owner: string): Promise<Holding[]> {
    await delay(0);
    const all = sims();
    return [0, 3, 9, 4].map((i, n) => ({
      token: all[i].summary,
      amount: Math.round(all[i].summary.circulating * [0.012, 0.004, 0.02, 0.0075][n]),
    }));
  },
};

export function sortTokens(tokens: TokenSummary[], sort: NonNullable<TokenQuery["sort"]>): TokenSummary[] {
  const by: Record<typeof sort, (t: TokenSummary) => number> = {
    reserve: (t) => -t.reserveSol,
    volume: (t) => -t.volume24hSol,
    newest: (t) => -t.createdAt,
    ratio: (t) => -(t.floorSol / t.priceSol),
  };
  return [...tokens].sort((a, b) => by[sort](a) - by[sort](b));
}
