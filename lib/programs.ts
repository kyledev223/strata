/**
 * On-chain addresses the site shows. The program ID comes from the generated
 * IDL and the treasury from config/limits.json, so there's nothing to keep in sync.
 */
import { CLUSTER } from "@/lib/config";
import { LIMITS } from "@/lib/limits";
import idl from "@/lib/strata/idl/strata.json";

/** One program (PROGRAM_SPEC D1): curve, reserve vault and redemption together. */
export const PROGRAM_LIST: { name: string; address: string }[] = [
  { name: "Strata program", address: idl.address },
  { name: "Launch-fee treasury", address: LIMITS.launch.treasury },
];

/** "mainnet", "devnet" or "localnet", for headings like "Programs on devnet". */
export const CLUSTER_LABEL = CLUSTER === "mainnet-beta" ? "mainnet" : CLUSTER;

/** PLACEHOLDER social links until the real accounts are set. */
export const LINKS = {
  github: "https://github.com/",
  x: "https://x.com/",
} as const;

/** A bare github.com / x.com URL is still the placeholder, so the UI hides it. */
export const isRealLink = (url: string) => !/^https:\/\/(github|x)\.com\/?$/.test(url);
