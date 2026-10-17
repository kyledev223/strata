/**
 * Typed view of config/limits.json, the single place every protocol limit lives.
 * Edit the JSON, not this file.
 */
import raw from "@/config/limits.json";

interface Range {
  min: number;
  max: number;
  default: number;
}

export interface Limits {
  token: {
    decimals: number;
    maxSupplyTokens: number;
    /** After any instruction, circulating supply is 0 or at least this. Stops rounding dust spiking the floor. */
    minCirculatingTokens: number;
    nameMaxChars: number;
    tickerMinChars: number;
    tickerMaxChars: number;
    descriptionMaxChars: number;
    imageMaxBytes: number;
  };
  curve: { virtualSolStart: number; virtualTokensStart: number };
  settings: {
    reserveShareBps: Range;
    feeToReserveBps: Range;
    creatorFeeBps: Range;
    vestingDays: Range;
    redemptionDelayHours: { options: number[]; default: number };
  };
  launch: { treasury: string; launchFeeSol: number; firstBuyMaxSol: number; firstBuyDefaultSol: number };
  trade: { minBuySol: number; defaultSlippageBps: number; dripSlots: number };
}

export const LIMITS: Limits = raw;

/** Basis points to a percentage number: 2500 -> 25 */
export const bpsToPct = (bps: number) => bps / 100;
