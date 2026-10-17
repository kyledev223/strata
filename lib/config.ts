export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";

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
