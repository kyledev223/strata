import "server-only";
import { Connection } from "@solana/web3.js";
import { RPC_ENDPOINT } from "@/lib/config";
import { mockDataSource } from "./mock";
import { RpcDataSource } from "./rpc";
import type { StrataDataSource } from "./types";

export * from "./types";

let source: StrataDataSource | null = null;

/** The single place the app picks where its data comes from. */
export function getDataSource(): StrataDataSource {
  if (source) return source;
  source =
    process.env.NEXT_PUBLIC_STRATA_DATA === "rpc"
      ? new RpcDataSource(new Connection(RPC_ENDPOINT, "confirmed"))
      : mockDataSource;
  return source;
}
