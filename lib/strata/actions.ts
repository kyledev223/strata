/**
 * Client-side entry points for every on-chain action. The UI only calls these.
 *
 * With NEXT_PUBLIC_PROGRAMS_LIVE=true they build real transactions against
 * the strata program and send them through the connected wallet. Otherwise
 * they return a labelled simulated result so the preview still works.
 */
import { BN } from "@anchor-lang/core";
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction, type Connection, type SendOptions, type Signer, type TransactionInstruction } from "@solana/web3.js";
import { PROGRAMS_LIVE } from "@/lib/config";
import type { LaunchSettings } from "@/lib/floor";
import {
  ataIx,
  buyIx,
  claimCreatorFeesIx,
  claimVestedIx,
  creatorBuyIx,
  initializeLaunchIx,
  pdas,
  programFor,
  redeemIx,
  sellIx,
  toBase,
  toLamports,
} from "./client";

/** The subset of the wallet adapter these calls need. */
export interface StrataSigner {
  publicKey: PublicKey;
  sendTransaction?: (tx: Transaction, connection: Connection, options?: SendOptions & { signers?: Signer[] }) => Promise<string>;
  connection?: Connection;
}

export interface TxResult {
  signature: string;
  /** True when the programs aren't live and nothing went on chain. */
  simulated: boolean;
}

export interface LaunchInput {
  name: string;
  ticker: string;
  description: string;
  image: File | null;
  settings: LaunchSettings;
  /** Optional creator first buy, in SOL. Vests per settings.vestingDays. */
  firstBuySol: number;
  /** Smallest acceptable first-buy output, in tokens (slippage). */
  minFirstBuyTokens?: number;
}

const fakeSig = () =>
  Array.from({ length: 88 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join("");
const settle = <T>(value: T, ms = 900) => new Promise<T>((res) => setTimeout(() => res(value), ms));

function live(signer: StrataSigner): asserts signer is Required<StrataSigner> {
  if (!signer.sendTransaction || !signer.connection) throw new Error("Connect a wallet first.");
}

/**
 * Compute-unit limits per action: measured cost plus headroom (PROGRAM_SPEC §14).
 * Priority fees are paid per requested unit, so a tight limit keeps them cheap.
 */
const CU = { launch: 300_000, buy: 150_000, sell: 200_000, redeem: 100_000, claim: 80_000 } as const;
const MIN_PRIORITY = 10_000; // micro-lamports per CU
const MAX_PRIORITY = 2_000_000;

/** A priority fee that lands under congestion: the 75th percentile of recent fees on these accounts, clamped. */
async function priorityFee(connection: Connection, writable: PublicKey[]): Promise<number> {
  try {
    const recent = await connection.getRecentPrioritizationFees({ lockedWritableAccounts: writable });
    const fees = recent.map((f) => f.prioritizationFee).filter((f) => f > 0).sort((a, b) => a - b);
    const p75 = fees.length ? fees[Math.floor(fees.length * 0.75)] : 0;
    return Math.min(Math.max(p75, MIN_PRIORITY), MAX_PRIORITY);
  } catch {
    return MIN_PRIORITY;
  }
}

async function send(
  signer: Required<StrataSigner>,
  ixs: TransactionInstruction[],
  opts: { units: number; writable: PublicKey[]; extra?: Signer[] },
): Promise<string> {
  const { connection } = signer;
  const microLamports = await priorityFee(connection, opts.writable);
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: opts.units }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ...ixs,
  );
  tx.feePayer = signer.publicKey;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  const signature = await signer.sendTransaction(tx, connection, { signers: opts.extra ?? [], skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
  const res = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  if (res.value.err) throw new Error(`Transaction failed: ${JSON.stringify(res.value.err)}`);
  // Refresh the cached homepage and projects list; a failure only delays it by a minute.
  await fetch("/api/revalidate", { method: "POST" }).catch(() => {});
  return signature;
}

/** Upload the picture and metadata JSON if an upload backend is configured. */
async function uploadMetadata(input: LaunchInput): Promise<string> {
  if (!input.image && !input.description.trim()) return "";
  const form = new FormData();
  form.set("name", input.name);
  form.set("symbol", input.ticker);
  form.set("description", input.description);
  if (input.image) form.set("image", input.image);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (res.status === 501) return ""; // uploads not configured: launch without a picture
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Upload failed.");
  return (await res.json()).uri as string;
}

export async function launchToken(signer: StrataSigner, input: LaunchInput): Promise<TxResult & { mint: string }> {
  if (!input.name.trim() || !input.ticker.trim()) throw new Error("Name and ticker are required.");
  if (!PROGRAMS_LIVE) return settle({ signature: fakeSig(), simulated: true, mint: fakeSig().slice(0, 44) }, 1400);
  live(signer);
  const uri = await uploadMetadata(input);
  const program = programFor(signer.connection);
  const mint = Keypair.generate();
  const s = input.settings;
  const ixs = [
    await initializeLaunchIx(program, signer.publicKey, mint.publicKey, {
      name: input.name.trim(),
      ticker: input.ticker,
      uri,
      reserveShareBps: s.reserveShareBps,
      feeToReserveBps: s.feeToReserveBps,
      creatorFeeBps: s.creatorFeeBps,
      vestingDays: s.vestingDays ?? 0,
      redemptionDelayHours: s.redemptionDelayHours,
    }),
  ];
  if (input.firstBuySol > 0) {
    ixs.push(ataIx(signer.publicKey, signer.publicKey, mint.publicKey));
    ixs.push(await creatorBuyIx(program, signer.publicKey, mint.publicKey, toLamports(input.firstBuySol), toBase(input.minFirstBuyTokens ?? 0)));
  }
  const signature = await send(signer, ixs, { units: CU.launch, writable: [pdas(mint.publicKey).launch], extra: [mint] });
  return { signature, simulated: false, mint: mint.publicKey.toBase58() };
}

export async function buy(signer: StrataSigner, mint: string, solIn: number, minTokensOut: number): Promise<TxResult> {
  if (!(solIn > 0)) throw new Error("Enter an amount of SOL.");
  if (!PROGRAMS_LIVE) return settle({ signature: fakeSig(), simulated: true });
  live(signer);
  const program = programFor(signer.connection);
  const m = new PublicKey(mint);
  const signature = await send(signer, [ataIx(signer.publicKey, signer.publicKey, m), await buyIx(program, signer.publicKey, m, toLamports(solIn), toBase(minTokensOut))], {
    units: CU.buy,
    writable: [pdas(m).launch],
  });
  return { signature, simulated: false };
}

/**
 * Sell routes to whichever pays more: the curve, down to the floor price,
 * then redemption at the floor for the rest. One instruction does both.
 */
export async function sell(signer: StrataSigner, mint: string, tokensIn: number, minSolOut: number): Promise<TxResult> {
  if (!(tokensIn > 0)) throw new Error("Enter an amount of tokens.");
  if (!PROGRAMS_LIVE) return settle({ signature: fakeSig(), simulated: true });
  live(signer);
  const program = programFor(signer.connection);
  const m = new PublicKey(mint);
  const signature = await send(signer, [await sellIx(program, signer.publicKey, m, toBase(tokensIn), toLamports(minSolOut))], { units: CU.sell, writable: [pdas(m).launch] });
  return { signature, simulated: false };
}

export async function redeemAtFloor(signer: StrataSigner, mint: string, tokens: number, minSolOut: number): Promise<TxResult> {
  if (!(tokens > 0)) throw new Error("Enter an amount of tokens.");
  if (!PROGRAMS_LIVE) return settle({ signature: fakeSig(), simulated: true });
  live(signer);
  const program = programFor(signer.connection);
  const m = new PublicKey(mint);
  const signature = await send(signer, [await redeemIx(program, signer.publicKey, m, toBase(tokens), toLamports(minSolOut))], { units: CU.redeem, writable: [pdas(m).launch] });
  return { signature, simulated: false };
}

export async function claimCreatorFees(signer: StrataSigner, mint: string): Promise<TxResult> {
  if (!PROGRAMS_LIVE) return settle({ signature: fakeSig(), simulated: true });
  live(signer);
  const program = programFor(signer.connection);
  const m = new PublicKey(mint);
  const signature = await send(signer, [await claimCreatorFeesIx(program, signer.publicKey, m)], { units: CU.claim, writable: [pdas(m).creatorFees] });
  return { signature, simulated: false };
}

export async function claimVested(signer: StrataSigner, mint: string): Promise<TxResult> {
  if (!PROGRAMS_LIVE) return settle({ signature: fakeSig(), simulated: true });
  live(signer);
  const program = programFor(signer.connection);
  const m = new PublicKey(mint);
  const signature = await send(signer, [ataIx(signer.publicKey, signer.publicKey, m), await claimVestedIx(program, signer.publicKey, m)], { units: CU.claim, writable: [pdas(m).launch] });
  return { signature, simulated: false };
}

export { BN };
