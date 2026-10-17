const nf = (max: number, min = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: max, minimumFractionDigits: min });

export function formatNumber(n: number, digits = 0): string {
  return nf(digits).format(n);
}

/** 1234 -> "1.23k", 1_200_000 -> "1.2M" */
export function formatCompact(n: number, digits = 2): string {
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [v, u] of units) {
    if (abs >= v) return `${nf(digits).format(n / v)}${u}`;
  }
  return nf(abs < 10 ? 2 : abs < 100 ? 1 : 0).format(n);
}

/** SOL amounts. Large values compact; small values keep enough precision. */
export function formatSol(n: number, { compact = true, unit = true } = {}): string {
  const abs = Math.abs(n);
  let s: string;
  if (compact && abs >= 10_000) s = formatCompact(n, 2);
  else if (abs >= 100) s = nf(1).format(n);
  else if (abs >= 1) s = nf(2).format(n);
  else if (abs === 0) s = "0";
  else if (abs >= 0.001) s = nf(4).format(n);
  else s = n.toPrecision(3);
  return unit ? `${s} SOL` : s;
}

export function formatBps(bps: number): string {
  return `${nf(2).format(bps / 100)}%`;
}

export function formatPct(ratio: number, digits = 1): string {
  return `${nf(digits).format(ratio * 100)}%`;
}

export function shortAddress(addr: string, chars = 4): string {
  return addr.length <= chars * 2 + 1 ? addr : `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

/**
 * Split a tiny per-token price for subscript-zero display:
 * 0.000000027961 -> { lead: "0.0", zeros: 7, digits: "2796" }  renders as 0.0₇2796
 */
export function tinyParts(n: number, sig = 4): { lead: string; zeros: number; digits: string } | null {
  if (!(n > 0) || n >= 0.001) return null;
  const exp = Math.floor(Math.log10(n)); // e.g. -8
  const zeros = -exp - 1; // zeros after the decimal point
  const digits = Math.round(n / 10 ** (exp - sig + 1)).toString().slice(0, sig);
  return { lead: "0.0", zeros, digits };
}

export function formatAge(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function solscanAccount(addr: string): string {
  return `https://solscan.io/account/${addr}`;
}
