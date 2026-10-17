import type { CurveState, LaunchSettings } from "@/lib/floor";

export interface ProtocolStats {
  now: {
    launches: number;
    reserveSol: number;
    volume24hSol: number;
  };
  allTime: {
    /** Number of times any floor stepped up (fee or rounding deposits). */
    floorRaises: number;
    /** Tokens redeemed at the floor and burned, summed across launches. */
    redeemedBurnedTokens: number;
    /** SOL paid out by redemptions. */
    redeemedSol: number;
    feesToReserveSol: number;
  };
  /** ms epoch the figures were read at */
  asOf: number;
}

export type LaunchStatus = "curve" | "complete";

export interface TokenSummary {
  mint: string;
  name: string;
  ticker: string;
  creator: string;
  description: string;
  createdAt: number;
  status: LaunchStatus;
  priceSol: number;
  floorSol: number;
  reserveSol: number;
  circulating: number;
  volume24hSol: number;
  change24h: number;
  holders: number;
  settings: LaunchSettings;
  curve: CurveState;
  /** Recent price samples, oldest first, for sparklines. */
  spark: number[];
  /** Floor at the same sample points. Never decreases. */
  floorSpark: number[];
  /** Seed for the generated token glyph when there is no image. */
  hue: number;
  image?: string;
  /** Surplus still dripping into the reserve (SOL). Not yet counted in the floor. */
  pendingSol?: number;
  /** Floor high-water mark, used when nothing circulates. */
  floorHwm?: number;
  /** Lifetime creator fees, in SOL, and the vesting state of the first buy. */
  creatorFeesSol?: number;
  vest?: { totalTokens: number; claimedTokens: number; start: number; days: number };
  redemptionOpensAt?: number;
}

export interface PricePoint {
  t: number;
  price: number;
  floor: number;
}

export interface TokenActivity {
  kind: "buy" | "sell" | "redeem" | "fee";
  wallet: string;
  sol: number;
  tokens: number;
  t: number;
}

export interface TokenDetail extends TokenSummary {
  history: PricePoint[];
  floorRaises: number;
  redeemedTokens: number;
  feesToReserveSol: number;
  activity: TokenActivity[];
}

export interface Holding {
  token: TokenSummary;
  amount: number;
}

export type TokenSort = "reserve" | "volume" | "newest" | "ratio";

export interface TokenQuery {
  status?: LaunchStatus | "all";
  sort?: TokenSort;
  search?: string;
}

/**
 * Everything the UI reads goes through this interface. The mock source is the
 * default; swap in the RPC source (lib/data/rpc.ts) once the programs are live.
 */
export interface StrataDataSource {
  getProtocolStats(): Promise<ProtocolStats>;
  listTokens(query?: TokenQuery): Promise<{ tokens: TokenSummary[]; asOf: number }>;
  getToken(mint: string): Promise<TokenDetail | null>;
  getHoldings(owner: string): Promise<Holding[]>;
}
