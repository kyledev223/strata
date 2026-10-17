/**
 * Client-side entry points for every on-chain action. The UI only calls these.
 *
 * Phase 1: each function validates its input, waits briefly, and returns a
 * fake signature so the forms can be exercised end to end.
 * Phase 2: replace each TODO with the Anchor call. Signatures and return
 * shapes are meant to stay the same.
 */
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { LaunchSettings } from "@/lib/floor";
import { PROGRAMS } from "@/lib/programs";

/** The subset of the wallet adapter these calls need. */
export interface StrataSigner {
  publicKey: PublicKey;
  signTransaction?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  sendTransaction?: unknown;
}

export interface TxResult {
  signature: string;
  /** True while these are stubs. The UI shows a "simulated" note. */
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
}

const fakeSig = () =>
  Array.from({ length: 88 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join("");

const settle = <T>(value: T, ms = 900) => new Promise<T>((res) => setTimeout(() => res(value), ms));

export async function launchToken(signer: StrataSigner, input: LaunchInput): Promise<TxResult & { mint: string }> {
  if (!input.name.trim() || !input.ticker.trim()) throw new Error("Name and ticker are required.");
  // TODO(phase 2): upload image + metadata JSON (Arweave/IPFS), get `uri`.
  // TODO(phase 2): program.methods
  //   .initializeLaunch({ name, ticker, uri, reserveShareBps, feeToReserveBps, creatorFeeBps,
  //                       vestingDays, redemptionDelayHours })
  //   .accounts({ creator: signer.publicKey, mint, launch: PDA(["launch", mint]),
  //               vault: PDA(["vault", mint], PROGRAMS.reserve), ... })
  //   .preInstructions(firstBuySol > 0 ? [buy ix with vesting escrow] : [])
  //   .signers([mintKeypair]).rpc()
  void signer;
  void PROGRAMS.launchpad;
  return settle({ signature: fakeSig(), simulated: true, mint: fakeSig().slice(0, 44) }, 1400);
}

export async function buy(signer: StrataSigner, mint: string, solIn: number, minTokensOut: number): Promise<TxResult> {
  if (!(solIn > 0)) throw new Error("Enter an amount of SOL.");
  // TODO(phase 2): program.methods.buy(new BN(solIn * LAMPORTS_PER_SOL), new BN(minTokensOut))
  //   .accounts({ buyer, launch, vault, curveVault, creatorFeeAccount, mint, buyerAta }).rpc()
  void signer;
  void mint;
  void minTokensOut;
  return settle({ signature: fakeSig(), simulated: true });
}

/**
 * Sell routes to whichever pays more: the curve, down to the floor price,
 * then redemption at the floor for the rest. One instruction does both.
 */
export async function sell(signer: StrataSigner, mint: string, tokensIn: number, minSolOut: number): Promise<TxResult> {
  if (!(tokensIn > 0)) throw new Error("Enter an amount of tokens.");
  // TODO(phase 2): program.methods.sell(new BN(tokensIn), new BN(minSolOut * LAMPORTS_PER_SOL))
  //   .accounts({ seller, launch, vault, curveVault, mint, sellerAta, redemption: PROGRAMS.redemption }).rpc()
  void signer;
  void mint;
  void minSolOut;
  return settle({ signature: fakeSig(), simulated: true });
}

export async function redeemAtFloor(signer: StrataSigner, mint: string, tokens: number, minSolOut: number): Promise<TxResult> {
  if (!(tokens > 0)) throw new Error("Enter an amount of tokens.");
  // TODO(phase 2): redemption program: burns `tokens` from holderAta and pays
  //   floor(tokens * vault.lamports / circulating) lamports from the vault PDA.
  //   program.methods.redeem(new BN(tokens), new BN(minSolOut * LAMPORTS_PER_SOL))
  //   .accounts({ holder, launch, vault: PDA(["vault", mint], PROGRAMS.reserve), mint, holderAta }).rpc()
  void signer;
  void mint;
  void minSolOut;
  void PROGRAMS.redemption;
  return settle({ signature: fakeSig(), simulated: true });
}
