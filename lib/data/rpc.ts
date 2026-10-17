/**
 * RPC-backed data source. Stubbed until the Anchor programs are deployed (phase 2).
 *
 * Each method documents the accounts it will read. Keep the return shapes
 * identical to the mock so no UI code changes when this is switched on with
 * NEXT_PUBLIC_STRATA_DATA=rpc.
 */
import { Connection } from "@solana/web3.js";
import { PROGRAMS } from "@/lib/programs";
import type { Holding, ProtocolStats, StrataDataSource, TokenDetail, TokenQuery, TokenSummary } from "./types";

export class RpcDataSource implements StrataDataSource {
  constructor(private readonly connection: Connection) {}

  async getProtocolStats(): Promise<ProtocolStats> {
    // TODO(phase 2): read the protocol `Stats` PDA owned by PROGRAMS.launchpad
    //   seeds: ["stats"]. Fields: launches, total_reserve_lamports,
    //   floor_raises, redeemed_base_units, redeemed_lamports, fees_to_reserve_lamports.
    // Volume 24h: sum `TradeEvent`s from the indexer (not derivable from account state).
    void this.connection;
    void PROGRAMS;
    throw new Error("RpcDataSource.getProtocolStats is not implemented yet");
  }

  async listTokens(_query?: TokenQuery): Promise<{ tokens: TokenSummary[]; asOf: number }> {
    // TODO(phase 2): getProgramAccounts(PROGRAMS.launchpad, filters: [{ memcmp: Launch discriminator }])
    //   then batch-fetch each launch's reserve vault (PROGRAMS.reserve, seeds ["vault", mint])
    //   and the mint supply. floor = vault.lamports / circulating.
    //   Metadata (name, ticker, image) comes from the Launch account + off-chain JSON.
    throw new Error("RpcDataSource.listTokens is not implemented yet");
  }

  async getToken(_mint: string): Promise<TokenDetail | null> {
    // TODO(phase 2): fetch Launch PDA (seeds ["launch", mint]), vault PDA, curve state,
    //   and price/floor history from the indexer.
    throw new Error("RpcDataSource.getToken is not implemented yet");
  }

  async getHoldings(_owner: string): Promise<Holding[]> {
    // TODO(phase 2): getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    //   keep mints that have a Launch account, join with listTokens().
    throw new Error("RpcDataSource.getHoldings is not implemented yet");
  }
}
