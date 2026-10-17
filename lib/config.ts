/** Which Solana cluster the site talks to: "devnet", "mainnet-beta" or "localnet". */
export const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";

const DEFAULT_RPC: Record<string, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  localnet: "http://127.0.0.1:8899",
};

/** RPC for the wallet adapter and the data source. The public defaults rate-limit; use a paid one in production. */
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || DEFAULT_RPC[CLUSTER] || DEFAULT_RPC.devnet;

/** Explorer link for a transaction or account on the configured cluster. */
export function explorerUrl(kind: "tx" | "account", id: string) {
  if (CLUSTER === "localnet") return `https://explorer.solana.com/${kind === "tx" ? "tx" : "address"}/${id}?cluster=custom&customUrl=${encodeURIComponent(RPC_ENDPOINT)}`;
  const q = CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`;
  return `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${id}${q}`;
}

/** True while figures come from the mock data source rather than chain reads. */
export const SAMPLE_DATA = process.env.NEXT_PUBLIC_STRATA_DATA !== "rpc";

/** Set NEXT_PUBLIC_PROGRAMS_LIVE=true once lib/strata/actions.ts sends real transactions. */
export const PROGRAMS_LIVE = process.env.NEXT_PUBLIC_PROGRAMS_LIVE === "true";

/** Canonical site URL for share cards, the sitemap and robots.txt. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

/** Show the preview notice while either of the above is still pretend. */
export const PREVIEW = SAMPLE_DATA || !PROGRAMS_LIVE;
