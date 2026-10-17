/**
 * Thin client for the on-chain strata program: IDs, PDAs and instruction
 * builders from the generated IDL. Shared by the browser (actions) and the
 * server (RPC data source).
 */
import { BN, Program, type Provider } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, type TransactionInstruction } from "@solana/web3.js";
import { LIMITS } from "@/lib/limits";
import idl from "./idl/strata.json";
import type { Strata } from "./idl/strata";

export const PROGRAM_ID = new PublicKey(idl.address);
export const MPL_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const TREASURY = new PublicKey(LIMITS.launch.treasury);
export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };

export const LAMPORTS = 1_000_000_000;
export const BASE = 10 ** LIMITS.token.decimals;

const seed = (s: string) => Buffer.from(s);

export function pdas(mint: PublicKey) {
  const find = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
  const launch = find([seed("launch"), mint.toBuffer()]);
  return {
    mint,
    launch,
    reserve: find([seed("reserve"), launch.toBuffer()]),
    curve: find([seed("curve"), launch.toBuffer()]),
    creatorFees: find([seed("creator_fees"), launch.toBuffer()]),
    vest: find([seed("vest"), launch.toBuffer()]),
    metadata: PublicKey.findProgramAddressSync([seed("metadata"), MPL_ID.toBuffer(), mint.toBuffer()], MPL_ID)[0],
  };
}

/** A program handle that only reads and builds instructions (no wallet needed). */
export function programFor(connection: Connection): Program<Strata> {
  return new Program<Strata>(idl as Strata, { connection } as Provider);
}

export const toLamports = (sol: number) => new BN(Math.round(sol * LAMPORTS).toString());
export const toBase = (tokens: number) => new BN(Math.floor(tokens * BASE).toString());

export function ataIx(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  return createAssociatedTokenAccountIdempotentInstruction(payer, getAssociatedTokenAddressSync(mint, owner), owner, mint);
}

export interface LaunchIxArgs {
  name: string;
  ticker: string;
  uri: string;
  reserveShareBps: number;
  feeToReserveBps: number;
  creatorFeeBps: number;
  vestingDays: number;
  redemptionDelayHours: number;
}

export async function initializeLaunchIx(program: Program<Strata>, creator: PublicKey, mint: PublicKey, a: LaunchIxArgs): Promise<TransactionInstruction> {
  const p = pdas(mint);
  return program.methods
    .initializeLaunch({
      name: a.name,
      ticker: a.ticker,
      uri: a.uri,
      reserveShareBps: a.reserveShareBps,
      feeToReserveBps: a.feeToReserveBps,
      creatorFeeBps: a.creatorFeeBps,
      vestingDays: a.vestingDays,
      redemptionDelayHours: a.redemptionDelayHours,
    })
    .accountsStrict({
      creator,
      mint,
      launch: p.launch,
      reserveVault: p.reserve,
      curveVault: p.curve,
      creatorFeeVault: p.creatorFees,
      metadata: p.metadata,
      treasury: TREASURY,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenMetadataProgram: MPL_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

export async function creatorBuyIx(program: Program<Strata>, creator: PublicKey, mint: PublicKey, lamports: BN, minTokens: BN) {
  const p = pdas(mint);
  return program.methods
    .creatorBuy(lamports, minTokens)
    .accountsStrict({
      creator,
      launch: p.launch,
      mint,
      reserveVault: p.reserve,
      curveVault: p.curve,
      creatorFeeVault: p.creatorFees,
      creatorToken: getAssociatedTokenAddressSync(mint, creator),
      vestEscrow: p.vest,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function buyIx(program: Program<Strata>, buyer: PublicKey, mint: PublicKey, lamports: BN, minTokens: BN) {
  const p = pdas(mint);
  return program.methods
    .buy(lamports, minTokens)
    .accountsStrict({
      buyer,
      launch: p.launch,
      mint,
      reserveVault: p.reserve,
      curveVault: p.curve,
      creatorFeeVault: p.creatorFees,
      buyerToken: getAssociatedTokenAddressSync(mint, buyer),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function sellIx(program: Program<Strata>, seller: PublicKey, mint: PublicKey, tokens: BN, minLamports: BN) {
  const p = pdas(mint);
  return program.methods
    .sell(tokens, minLamports)
    .accountsStrict({
      seller,
      launch: p.launch,
      mint,
      reserveVault: p.reserve,
      curveVault: p.curve,
      creatorFeeVault: p.creatorFees,
      sellerToken: getAssociatedTokenAddressSync(mint, seller),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export async function redeemIx(program: Program<Strata>, holder: PublicKey, mint: PublicKey, tokens: BN, minLamports: BN) {
  const p = pdas(mint);
  return program.methods
    .redeem(tokens, minLamports)
    .accountsStrict({
      holder,
      launch: p.launch,
      mint,
      reserveVault: p.reserve,
      curveVault: p.curve,
      holderToken: getAssociatedTokenAddressSync(mint, holder),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export async function claimVestedIx(program: Program<Strata>, creator: PublicKey, mint: PublicKey) {
  const p = pdas(mint);
  return program.methods
    .claimVested()
    .accountsStrict({
      creator,
      launch: p.launch,
      mint,
      vestEscrow: p.vest,
      creatorToken: getAssociatedTokenAddressSync(mint, creator),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export async function claimCreatorFeesIx(program: Program<Strata>, creator: PublicKey, mint: PublicKey) {
  const p = pdas(mint);
  return program.methods.claimCreatorFees().accountsStrict({ creator, launch: p.launch, creatorFeeVault: p.creatorFees }).instruction();
}
