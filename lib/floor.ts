/**
 * Floor math shared by the homepage calculator, the launch preview, the trade
 * panel and the mock data. It mirrors PROGRAM_SPEC.md in floating point,
 * rounding to whole lamports and token base units the same way the program will.
 *
 *   floor = reserve_SOL / circulating_supply
 *
 * Rules (confirmed):
 *  1. A buy adds at least ceil(floor x tokens minted) to the reserve, or it fails.
 *  2. A sell goes to the curve while the curve pays at least the floor (net of
 *     fees); the rest is redeemed at the floor in the same transaction.
 *  3. No redemption fee. Every rounding favours the vault: payouts round down,
 *     amounts owed to the reserve round up. Supply = 0 is guarded by a floor
 *     high-water mark.
 *  4. Fees are taken in SOL and never come out of the reserve.
 *  5. The floor never decreases across any operation.
 *  6. After any operation, circulating supply is 0 or at least MIN_CIRCULATING,
 *     so a lamport of rounding dust can't spike the floor on a sliver of supply.
 */
import { LIMITS } from "@/lib/limits";

export const BPS = 10_000;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const BASE_UNITS = 10 ** LIMITS.token.decimals;

export const CURVE_START = {
  virtualSol: LIMITS.curve.virtualSolStart,
  virtualTokens: LIMITS.curve.virtualTokensStart,
} as const;
export const TOTAL_SUPPLY = LIMITS.token.maxSupplyTokens;
export const MIN_CIRCULATING = LIMITS.token.minCirculatingTokens;

/* ------------------------------------------------------------ rounding */

// A small tolerance absorbs float noise (e.g. 35999999999.999996 lamports).
const EPS = 1e-6;
/** Round SOL down to a whole lamport: payouts to users. */
export const lamDown = (sol: number) => Math.floor(sol * LAMPORTS_PER_SOL + EPS) / LAMPORTS_PER_SOL;
/** Round SOL up to a whole lamport: amounts owed to the reserve. */
export const lamUp = (sol: number) => Math.ceil(sol * LAMPORTS_PER_SOL - EPS) / LAMPORTS_PER_SOL;
/** Round tokens down to a whole base unit: tokens given to users. */
export const tokDown = (t: number) => Math.floor(t * BASE_UNITS + EPS) / BASE_UNITS;
/** Round tokens up to a whole base unit: tokens taken from users or required. */
export const tokUp = (t: number) => Math.ceil(t * BASE_UNITS - EPS) / BASE_UNITS;

/* --------------------------------------------------------------- state */

export interface LaunchSettings {
  /** Share of every buy (after fees) that goes into the reserve vault. */
  reserveShareBps: number;
  /** Trading fee on buys and sells that goes straight into the reserve. */
  feeToReserveBps: number;
  /** Trading fee on buys and sells paid to the creator. */
  creatorFeeBps: number;
  /** Creator's first buy vests linearly over this many days. null = no first-buy vesting. */
  vestingDays: number | null;
  /** Redemption opens this many hours after launch. 0 = from the first block. */
  redemptionDelayHours: number;
}

export interface CurveState {
  virtualSol: number;
  virtualTokens: number;
}

export interface ReserveState {
  reserveSol: number;
  circulating: number;
  /** Highest floor ever recorded. Used as the floor while circulating = 0. */
  floorHwm?: number;
  /**
   * Surplus in the reserve vault not yet counted toward the floor. It drips
   * into the reserve over ~150 slots (spec D2). Quotes treat it as not yet
   * released, which is conservative: the chain releases it before trading.
   */
  pendingSol?: number;
}

export type PoolState = CurveState & ReserveState & { settings: LaunchSettings };

/** reserve / supply, or 0 when nothing circulates. */
export function floorOf({ reserveSol, circulating }: ReserveState): number {
  return circulating > 0 ? reserveSol / circulating : 0;
}

/** The floor a new token must be backed at: the live floor, or the high-water mark at zero supply. */
export function requiredFloor(s: ReserveState): number {
  return s.circulating > 0 ? Math.max(floorOf(s), s.floorHwm ?? 0) : (s.floorHwm ?? 0);
}

/**
 * Snap reserve and supply back onto the lamport / base-unit grid (they are
 * integers on chain; floats drift) and record the floor high-water mark.
 */
function withHwm<T extends ReserveState>(s: T): T {
  const snapped = {
    ...s,
    reserveSol: Math.round(s.reserveSol * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL,
    pendingSol: Math.round((s.pendingSol ?? 0) * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL,
    circulating: Math.round(s.circulating * BASE_UNITS) / BASE_UNITS,
  };
  return { ...snapped, floorHwm: Math.max(s.floorHwm ?? 0, floorOf(snapped)) };
}

/** Release all pending surplus into the reserve (as if the drip window passed). */
export function settleDrip<T extends ReserveState>(s: T): T {
  if (!s.pendingSol || s.circulating <= 0) return s;
  return withHwm({ ...s, reserveSol: s.reserveSol + s.pendingSol, pendingSol: 0 });
}

/** Invariant 6: supply is either fully redeemed or comfortably above dust. */
export function residualOk(s: ReserveState): boolean {
  return s.circulating === 0 || s.circulating >= MIN_CIRCULATING;
}

/** Invariant 5. Tolerates float noise only; the program compares exactly. */
export function floorNotDown(before: ReserveState, after: ReserveState): boolean {
  const b = requiredFloor(before);
  const a = after.circulating > 0 ? floorOf(after) : requiredFloor(after);
  return a >= b * (1 - 1e-12);
}

function assertFloor(before: ReserveState, after: ReserveState, op: string) {
  if (!floorNotDown(before, after)) throw new Error(`Floor invariant violated by ${op}`);
}

export function spotPrice({ virtualSol, virtualTokens }: CurveState): number {
  return virtualTokens > 0 ? virtualSol / virtualTokens : 0;
}

/** Tokens still available from the curve before max supply. Buys stop at 0 ("curve complete"). */
export function curveInventory(c: CurveState): number {
  return Math.max(0, tokDown(c.virtualTokens - (CURVE_START.virtualTokens - TOTAL_SUPPLY)));
}

/** What a holder can actually get: the curve's price, or the floor if that is higher. */
export function effectivePrice(pool: CurveState & ReserveState): number {
  return Math.max(spotPrice(pool), requiredFloor(pool));
}

/* ---------------------------------------------------------------- curve */

/** Tokens out for `solIn` on the constant-product curve, rounded down. */
function curveTokensOut(c: CurveState, solIn: number) {
  if (solIn <= 0) return 0;
  const k = c.virtualSol * c.virtualTokens;
  return Math.max(0, tokDown(c.virtualTokens - k / (c.virtualSol + solIn)));
}

/** Minimum SOL the curve must receive to release `tokens`, rounded up. */
function curveSolFor(c: CurveState, tokens: number) {
  const k = c.virtualSol * c.virtualTokens;
  return lamUp(k / (c.virtualTokens - tokens) - c.virtualSol);
}

/* ------------------------------------------------------------------ buy */

/**
 * Quote a buy.
 * 1. Creator fee (rounded down) and reserve fee (rounded up) come off the top.
 * 2. The reserve share of the rest (rounded up) goes to the vault.
 * 3. If that is less than ceil(floor x tokens), solve for the largest token
 *    amount whose floor cost plus curve cost fits in `net`. Any rounding
 *    surplus goes to the reserve.
 */
export function quoteBuy(pool: PoolState, solIn: number) {
  const s = pool.settings;
  const before = pool;
  const F = requiredFloor(pool);
  const creatorFee = lamDown((solIn * s.creatorFeeBps) / BPS);
  const reserveFee = lamUp((solIn * s.feeToReserveBps) / BPS);
  const net = Math.max(0, lamDown(solIn - creatorFee - reserveFee));

  const share = Math.min(net, lamUp((net * s.reserveShareBps) / BPS));
  let tokensOut = curveTokensOut(pool, net - share);
  let deposit = share;
  let toppedUp = false;

  if (lamUp(F * tokensOut) > share) {
    // Largest t with floorCost(t) + curveCost(t) <= net. Monotonic, so bisect.
    toppedUp = true;
    let lo = 0;
    let hi = tokensOut;
    for (let i = 0; i < 64; i++) {
      const mid = tokDown((lo + hi) / 2);
      if (mid <= lo) break;
      if (lamUp(F * mid) + curveSolFor(pool, mid) <= net) lo = mid;
      else hi = mid;
    }
    tokensOut = lo;
    const toCurve = tokensOut > 0 ? curveSolFor(pool, tokensOut) : 0;
    deposit = net - toCurve;
  }

  const toCurve = net - deposit;
  const required = lamUp(F * tokensOut);
  // Backing counts toward the floor now; the surplus drips in (unless nothing circulated).
  const intoVault = deposit + reserveFee;
  const now = pool.circulating > 0 ? required : intoVault;
  const after: PoolState = withHwm({
    ...pool,
    reserveSol: pool.reserveSol + now,
    pendingSol: (pool.pendingSol ?? 0) + (intoVault - now),
    circulating: pool.circulating + tokensOut,
    virtualSol: pool.virtualSol + toCurve,
    virtualTokens: pool.virtualTokens - tokensOut,
  });

  // Invariant 1: hard check, the program fails the instruction here.
  const ok = tokensOut > 0 && deposit + 1e-12 >= required && residualOk(after);
  if (tokensOut > 0) assertFloor(before, after, "buy");

  return {
    ok,
    solIn,
    tokensOut,
    creatorFee,
    reserveFee,
    deposit,
    required,
    toppedUp,
    toCurve,
    avgPrice: tokensOut > 0 ? solIn / tokensOut : 0,
    priceAfter: spotPrice(after),
    floorBefore: F,
    floorAfter: requiredFloor(after),
    /** The floor once this buy's surplus has dripped in (~1 minute). */
    floorAfterDrip: requiredFloor(settleDrip(after)),
    after,
  };
}

/* ----------------------------------------------------------- sell (curve) */

/** Sell to the curve only. Burned tokens leave circulation, so the floor rises. */
export function quoteSell(pool: PoolState, tokensIn: number) {
  const s = pool.settings;
  const amount = Math.max(0, Math.min(tokUp(tokensIn), pool.circulating));
  const k = pool.virtualSol * pool.virtualTokens;
  const virtualTokens = pool.virtualTokens + amount;
  const virtualSol = k / virtualTokens;
  const gross = lamDown(pool.virtualSol - virtualSol);
  const creatorFee = lamDown((gross * s.creatorFeeBps) / BPS);
  const reserveFee = lamUp((gross * s.feeToReserveBps) / BPS);
  const solOut = Math.max(0, gross - creatorFee - reserveFee);
  const after: PoolState = withHwm({
    ...pool,
    pendingSol: (pool.pendingSol ?? 0) + reserveFee, // fees drip to the holders who stay
    circulating: pool.circulating - amount,
    virtualTokens,
    virtualSol: pool.virtualSol - gross,
  });
  const redeemInstead = lamDown(amount * floorOf(pool));
  return {
    ok: residualOk(after),
    tokensIn: amount,
    gross,
    solOut,
    creatorFee,
    reserveFee,
    priceAfter: spotPrice(after),
    floorBefore: requiredFloor(pool),
    floorAfter: requiredFloor(after),
    redeemPaysMore: redeemInstead > solOut,
    redeemInstead,
    after,
  };
}

/* --------------------------------------------------------------- redeem */

/** Redeem `tokens` at the floor. They are burned and paid out of the reserve, rounded down. */
export function redeem<T extends ReserveState>(state: T, tokens: number) {
  // Guard supply = 0: nothing to redeem, nothing paid.
  const amount = state.circulating > 0 ? Math.max(0, Math.min(tokDown(tokens), state.circulating)) : 0;
  const floorBefore = requiredFloor(state);
  // amount x reserve / supply, not amount x floor, to keep precision. Redeeming
  // every token pays out exactly the reserve.
  // Redeeming the whole supply also collects any pending surplus, so nothing is orphaned.
  const all = amount > 0 && amount === state.circulating;
  const pool = all ? (state.pendingSol ?? 0) : 0;
  const payoutSol = amount === 0 ? 0 : all ? state.reserveSol + pool : lamDown((amount * state.reserveSol) / state.circulating);
  const after = withHwm({
    ...state,
    reserveSol: all ? 0 : state.reserveSol - payoutSol,
    pendingSol: all ? 0 : state.pendingSol,
    circulating: state.circulating - amount,
  });
  if (amount > 0) assertFloor(state, after, "redeem");
  return { ok: residualOk(after), amount, payoutSol, floorBefore, floorAfter: requiredFloor(after), after };
}

/** A fee lands in the reserve. Supply is unchanged, so the floor rises. */
export function addToReserve<T extends ReserveState>(state: T, feeSol: number) {
  const after = withHwm({ ...state, reserveSol: state.reserveSol + lamUp(Math.max(0, feeSol)) });
  return { floorBefore: requiredFloor(state), floorAfter: requiredFloor(after), after };
}

/* ---------------------------------------------------------- sell (routed) */

/**
 * Quote an exit that routes to whichever pays more. Tokens go to the curve
 * while its marginal price, net of fees, is at least the floor; the rest are
 * redeemed at the (by then slightly higher) floor in the same transaction.
 * `redemptionOpen = false` blocks the redemption leg; the caller must then
 * sell no more than `toCurve`.
 */
export function quoteExit(pool: PoolState, tokensIn: number, redemptionOpen = true) {
  const amount = Math.max(0, Math.min(tokUp(tokensIn), pool.circulating));
  const F = floorOf(pool);
  const feeFrac = (pool.settings.creatorFeeBps + pool.settings.feeToReserveBps) / BPS;
  const k = pool.virtualSol * pool.virtualTokens;
  // Marginal curve price after selling t is k / (vT + t)^2. Keep it, net of
  // fees, at or above the floor: (vT + t)^2 <= k (1 - fees) / F.
  const vtLimit = F > 0 ? Math.sqrt((k * (1 - feeFrac)) / F) : Infinity;
  const curveRoom = Math.max(0, tokDown(vtLimit - pool.virtualTokens));
  const toCurve = Math.min(amount, curveRoom);
  const sell = quoteSell(pool, toCurve);
  const toRedeemWanted = amount - sell.tokensIn;
  const blocked = toRedeemWanted > 0 && !redemptionOpen;
  const rd = redeem(sell.after, blocked ? 0 : toRedeemWanted);
  const after: PoolState = rd.after;
  if (amount > 0) assertFloor(pool, after, "sell");
  const solOut = sell.solOut + rd.payoutSol;
  return {
    /** False when the program would reject it: redemption closed, or a dust residual left behind. */
    ok: !blocked && residualOk(after),
    tokensIn: amount,
    toCurve: sell.tokensIn,
    toRedeem: rd.amount,
    blocked,
    solFromCurve: sell.solOut,
    solFromRedeem: rd.payoutSol,
    solOut,
    creatorFee: sell.creatorFee,
    reserveFee: sell.reserveFee,
    fees: sell.creatorFee + sell.reserveFee,
    avgPrice: amount > 0 ? solOut / amount : 0,
    floorBefore: requiredFloor(pool),
    floorAfter: requiredFloor(after),
    after,
  };
}

/* --------------------------------------------------------------- launch */

/** A brand-new launch: empty reserve, nothing circulating, curve at its start. */
export function freshPool(settings: LaunchSettings): PoolState {
  return { ...CURVE_START, reserveSol: 0, circulating: 0, floorHwm: 0, settings };
}

/**
 * The floor a launch starts with after its first buy. With an empty vault and
 * no history the first buy sets it: floor = deposit / tokens bought.
 */
export function startingFloor(settings: LaunchSettings, firstBuySol: number) {
  const pool = freshPool(settings);
  const sol = firstBuySol > 0 ? firstBuySol : 1;
  const q = quoteBuy(pool, sol);
  return {
    startPrice: spotPrice(pool),
    floor: q.floorAfter,
    priceAfter: q.priceAfter,
    tokensOut: q.tokensOut,
    floorShareOfPrice: q.priceAfter > 0 ? q.floorAfter / q.priceAfter : 0,
  };
}
