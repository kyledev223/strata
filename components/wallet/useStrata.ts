"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { SAMPLE_DATA } from "@/lib/config";
import type { StrataSigner } from "@/lib/strata/actions";

let nowValue = 0;
const nowSubscribers = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;
function subscribeNow(cb: () => void) {
  nowSubscribers.add(cb);
  if (!nowTimer) {
    nowValue = Date.now();
    nowTimer = setInterval(() => {
      nowValue = Date.now();
      nowSubscribers.forEach((f) => f());
    }, 15_000);
  }
  return () => {
    nowSubscribers.delete(cb);
    if (!nowSubscribers.size && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

/** Wall-clock time that updates every 15 s; 0 during server render. */
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => nowValue || (nowValue = Date.now()), () => 0);
}

/** The connected wallet as a signer for lib/strata/actions, or null. */
export function useStrataSigner(): StrataSigner | null {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  return useMemo(() => (publicKey ? { publicKey, sendTransaction, connection } : null), [publicKey, sendTransaction, connection]);
}

/**
 * The wallet's SOL and token balance for a mint. Real chain reads when the site
 * uses real data; a labelled demo balance on sample data. `refresh` re-reads.
 */
export function useBalances(mint: string, demoTokens: number) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<{ sol: number; tokens: number; demo: boolean } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!publicKey) {
      Promise.resolve().then(() => !cancelled && setState(null));
      return () => {
        cancelled = true;
      };
    }
    if (SAMPLE_DATA) {
      Promise.resolve().then(() => !cancelled && setState({ sol: 12.5, tokens: demoTokens, demo: true }));
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const lamports = await connection.getBalance(publicKey).catch(() => 0);
      let tokens = 0;
      try {
        const ata = getAssociatedTokenAddressSync(new PublicKey(mint), publicKey);
        const b = await connection.getTokenAccountBalance(ata);
        tokens = b.value.uiAmount ?? 0;
      } catch {
        tokens = 0; // no token account yet
      }
      if (!cancelled) setState({ sol: lamports / 1e9, tokens, demo: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection, mint, demoTokens, tick]);

  return { balance: state, refresh: () => setTick((t) => t + 1) };
}
