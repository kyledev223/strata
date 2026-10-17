/**
 * RPC-backed data source: reads launches straight from the strata program.
 * Enabled with NEXT_PUBLIC_STRATA_DATA=rpc. No indexer needed: prices, floors,
 * 24h volume and chart history come from each launch's on-chain stats rings,
 * and recent activity from the program's Trade events.
 */
import { EventParser, type BN } from "@anchor-lang/core";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { curveInventory } from "@/lib/floor";
import { BASE, LAMPORTS, pdas, programFor, PROGRAM_ID } from "@/lib/strata/client";
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
const HOURS = 48;
const DAYS = 32;
const PER_M_TO_SOL_PER_TOKEN = 1 / (LAMPORTS * 1_000_000);

type Program = ReturnType<typeof programFor>;
type LaunchAccount = Awaited<ReturnType<Program["account"]["launch"]["fetch"]>>;
interface Bucket {
  pricePerM: BN;
  floorPerM: BN;
  volume: BN;
}

const n = (b: BN | number | bigint) => Number(b.toString());
const sol = (lamports: BN | number) => n(lamports) / LAMPORTS;
const tokens = (base: BN | number) => n(base) / BASE;

function hueOf(mint: string) {
  let h = 0;
  for (const c of mint) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Walk a ring buffer backwards from its newest bucket. */
function ringPoints(ring: Bucket[], newestIndex: number, unitMs: number, size: number, notBefore: number, nowMs: number) {
  const pts: { t: number; price: number; floor: number; volume: number }[] = [];
  if (newestIndex <= 0) return pts;
  const nowUnit = Math.floor(nowMs / unitMs);
  for (let i = newestIndex - size + 1; i <= newestIndex; i++) {
    const t = i * unitMs;
    if (t + unitMs < notBefore) continue;
    const b = ring[((i % size) + size) % size];
    pts.push({ t: Math.min(t + unitMs, nowMs), price: n(b.pricePerM) * PER_M_TO_SOL_PER_TOKEN, floor: n(b.floorPerM) * PER_M_TO_SOL_PER_TOKEN, volume: sol(b.volume) });
  }
  // No trades since the newest bucket: carry the last close forward to now.
  const last = pts.at(-1);
  if (last && nowUnit > newestIndex) pts.push({ ...last, t: nowMs, volume: 0 });
  return pts;
}

export class RpcDataSource implements StrataDataSource {
  private program: Program;
  private metaCache = new Map<string, { image?: string; description?: string }>();

  constructor(private readonly connection: Connection) {
    this.program = programFor(connection);
  }

  private async metadata(uri: string) {
    if (!uri) return {};
    const hit = this.metaCache.get(uri);
    if (hit) return hit;
    try {
      const res = await fetch(uri, { next: { revalidate: 3600 } });
      const j = (await res.json()) as { image?: string; description?: string };
      const m = { image: typeof j.image === "string" ? j.image : undefined, description: typeof j.description === "string" ? j.description : undefined };
      this.metaCache.set(uri, m);
      return m;
    } catch {
      return {};
    }
  }

  private async holders(mint: PublicKey): Promise<number> {
    try {
      const accts = await this.connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint.toBase58() } }],
        dataSlice: { offset: 64, length: 8 },
      });
      return accts.filter((a) => a.account.data.some((byte) => byte !== 0)).length;
    } catch {
      return 0;
    }
  }

  private async summarise(acc: LaunchAccount, now: number): Promise<TokenSummary & { _hourly: ReturnType<typeof ringPoints>; _daily: ReturnType<typeof ringPoints> }> {
    const mint = acc.mint.toBase58();
    const p = acc.pool;
    const supply = tokens(p.supply);
    const reserveSol = sol(p.reserve);
    const vS = sol(p.vSol);
    const vT = tokens(p.vTokens);
    const spot = vT > 0 ? vS / vT : 0;
    const floor = supply > 0 ? reserveSol / supply : 0;
    const hwm = n(p.hwmSupply) > 0 ? sol(p.hwmReserve) / tokens(p.hwmSupply) : 0;
    const createdAt = n(acc.createdAt) * 1000;

    const hourly = ringPoints(acc.hourly as Bucket[], n(acc.hourIndex), HOUR, HOURS, createdAt, now);
    const daily = ringPoints(acc.daily as Bucket[], n(acc.dayIndex), 24 * HOUR, DAYS, createdAt, now);
    const volume24h = hourly.filter((x) => x.t > now - 24 * HOUR).reduce((a, x) => a + x.volume, 0);
    const dayAgo = [...hourly].reverse().find((x) => x.t <= now - 24 * HOUR);
    const priceNow = Math.max(spot, floor);
    const spark = hourly.length ? hourly : [{ t: now, price: priceNow, floor, volume: 0 }];
    const [meta, holders] = await Promise.all([this.metadata(acc.uri), this.holders(acc.mint)]);

    return {
      mint,
      name: acc.name,
      ticker: acc.ticker,
      creator: acc.creator.toBase58(),
      description: meta.description ?? "",
      image: meta.image,
      createdAt,
      status: curveInventory({ virtualSol: vS, virtualTokens: vT }) <= 0 ? "complete" : "curve",
      priceSol: priceNow,
      floorSol: floor,
      reserveSol,
      pendingSol: sol(p.pending),
      floorHwm: hwm,
      circulating: supply,
      volume24hSol: volume24h,
      change24h: dayAgo && dayAgo.price > 0 ? priceNow / Math.max(dayAgo.price, dayAgo.floor) - 1 : 0,
      holders,
      settings: {
        reserveShareBps: acc.reserveShareBps,
        feeToReserveBps: acc.feeToReserveBps,
        creatorFeeBps: acc.creatorFeeBps,
        vestingDays: acc.vestingDays > 0 ? acc.vestingDays : null,
        redemptionDelayHours: Math.round((n(acc.redemptionOpensAt) - n(acc.createdAt)) / 3600),
      },
      curve: { virtualSol: vS, virtualTokens: vT },
      spark: spark.map((x) => Math.max(x.price, x.floor)),
      floorSpark: spark.map((x) => x.floor),
      hue: hueOf(mint),
      creatorFeesSol: sol(acc.creatorFeesTotal),
      vest: acc.vestingDays > 0 ? { totalTokens: tokens(acc.vestTotal), claimedTokens: tokens(acc.vestClaimed), start: n(acc.vestStart) * 1000, days: acc.vestingDays } : undefined,
      redemptionOpensAt: n(acc.redemptionOpensAt) * 1000,
      _hourly: hourly,
      _daily: daily,
    };
  }

  private async all(now: number) {
    const accounts = await this.program.account.launch.all();
    return Promise.all(accounts.map((a) => this.summarise(a.account, now).then((s) => ({ s, acc: a.account }))));
  }

  async getProtocolStats(): Promise<ProtocolStats> {
    const now = Date.now();
    const rows = await this.all(now);
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    return {
      now: {
        launches: rows.length,
        reserveSol: sum((r) => r.s.reserveSol + (r.s.pendingSol ?? 0)),
        volume24hSol: sum((r) => r.s.volume24hSol),
      },
      allTime: {
        floorRaises: sum((r) => n(r.acc.floorRaises)),
        redeemedBurnedTokens: sum((r) => tokens(r.acc.redeemedBase)),
        redeemedSol: sum((r) => sol(r.acc.redeemedLamports)),
        feesToReserveSol: sum((r) => sol(r.acc.feesToReserve)),
      },
      asOf: now,
    };
  }

  async listTokens(query: TokenQuery = {}): Promise<{ tokens: TokenSummary[]; asOf: number }> {
    const now = Date.now();
    let list: TokenSummary[] = (await this.all(now)).map(({ s }) => strip(s));
    if (query.status && query.status !== "all") list = list.filter((t) => t.status === query.status);
    const q = query.search?.trim().toLowerCase();
    if (q) list = list.filter((t) => [t.name, t.ticker, t.mint].some((v) => v.toLowerCase().includes(q)));
    const by: Record<NonNullable<TokenQuery["sort"]>, (t: TokenSummary) => number> = {
      reserve: (t) => -t.reserveSol,
      volume: (t) => -t.volume24hSol,
      newest: (t) => -t.createdAt,
      ratio: (t) => -(t.floorSol / (t.priceSol || 1)),
    };
    list.sort((a, b) => by[query.sort ?? "reserve"](a) - by[query.sort ?? "reserve"](b));
    return { tokens: list, asOf: now };
  }

  async getToken(mint: string): Promise<TokenDetail | null> {
    let key: PublicKey;
    try {
      key = new PublicKey(mint);
    } catch {
      return null;
    }
    const acc = await this.program.account.launch.fetchNullable(pdas(key).launch);
    if (!acc) return null;
    const now = Date.now();
    const s = await this.summarise(acc, now);
    const hourStart = s._hourly[0]?.t ?? now;
    const history: PricePoint[] = [
      ...s._daily.filter((d) => d.t < hourStart).map((d) => ({ t: d.t, price: Math.max(d.price, d.floor), floor: d.floor })),
      ...s._hourly.map((h) => ({ t: h.t, price: Math.max(h.price, h.floor), floor: h.floor })),
    ];
    if (history.length < 2) history.unshift({ t: s.createdAt, price: s.priceSol, floor: s.floorSol }, { t: now, price: s.priceSol, floor: s.floorSol });
    return {
      ...strip(s),
      history,
      floorRaises: n(acc.floorRaises),
      redeemedTokens: tokens(acc.redeemedBase),
      feesToReserveSol: sol(acc.feesToReserve),
      activity: await this.activity(pdas(key).launch),
    };
  }

  private async activity(launch: PublicKey): Promise<TokenActivity[]> {
    try {
      const sigs = await this.connection.getSignaturesForAddress(launch, { limit: 20 }, "confirmed");
      const txs = await this.connection.getTransactions(
        sigs.filter((x) => !x.err).map((x) => x.signature),
        { maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      );
      const parser = new EventParser(PROGRAM_ID, this.program.coder);
      const out: TokenActivity[] = [];
      for (const tx of txs) {
        for (const ev of parser.parseLogs(tx?.meta?.logMessages ?? [])) {
          if (ev.name !== "trade") continue;
          const d = ev.data as { kind: number; user: PublicKey; lamports: BN; tokens: BN; redeemedTokens: BN; ts: BN };
          const kind = d.kind === 0 ? "buy" : d.kind === 2 || n(d.redeemedTokens) * 2 > n(d.tokens) ? "redeem" : "sell";
          out.push({ kind, wallet: d.user.toBase58(), sol: sol(d.lamports), tokens: tokens(d.tokens), t: n(d.ts) * 1000 });
        }
      }
      return out.sort((a, b) => b.t - a.t);
    } catch {
      return [];
    }
  }

  async getHoldings(owner: string): Promise<Holding[]> {
    let key: PublicKey;
    try {
      key = new PublicKey(owner);
    } catch {
      return [];
    }
    const [{ tokens: list }, accts] = await Promise.all([
      this.listTokens(),
      this.connection.getParsedTokenAccountsByOwner(key, { programId: TOKEN_PROGRAM_ID }),
    ]);
    const balances = new Map<string, number>();
    for (const a of accts.value) {
      const info = a.account.data.parsed.info as { mint: string; tokenAmount: { uiAmount: number | null } };
      balances.set(info.mint, (balances.get(info.mint) ?? 0) + (info.tokenAmount.uiAmount ?? 0));
    }
    return list.filter((t) => (balances.get(t.mint) ?? 0) > 0).map((token) => ({ token, amount: balances.get(token.mint)! }));
  }
}

/** Drop the internal ring arrays before handing data to the UI. */
function strip<T extends { _hourly?: unknown; _daily?: unknown }>(s: T): Omit<T, "_hourly" | "_daily"> {
  const { _hourly, _daily, ...rest } = s;
  return rest;
}

