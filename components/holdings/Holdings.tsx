"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { IconArrowRight } from "@/components/icons";
import { TokenGlyph } from "@/components/token/TokenGlyph";
import { btn, Panel, SolPrice, Stat, StatGrid } from "@/components/ui";
import { useWalletDialog } from "@/components/wallet/WalletProviders";
import { SAMPLE_DATA } from "@/lib/config";
import type { Holding } from "@/lib/data/types";
import { formatCompact, formatPct, formatSol } from "@/lib/format";

/**
 * Holdings with their value at price and at the floor. Shows example holdings
 * until a wallet connects.
 * TODO(phase 2): fetch the connected wallet's holdings client-side (getHoldings(owner)).
 */
export function Holdings({ holdings: sample, mode }: { holdings: Holding[]; mode: "redeem" | "portfolio" }) {
  const { publicKey } = useWallet();
  const { open } = useWalletDialog();
  const [real, setReal] = useState<{ owner: string; holdings: Holding[]; error?: string } | null>(null);
  const owner = publicKey?.toBase58();

  useEffect(() => {
    if (SAMPLE_DATA || !owner) return;
    let cancelled = false;
    fetch(`/api/holdings?owner=${owner}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setReal({ owner, holdings: j.holdings ?? [], error: j.error }))
      .catch(() => !cancelled && setReal({ owner, holdings: [], error: "Could not load holdings." }));
    return () => {
      cancelled = true;
    };
  }, [owner]);

  if (!SAMPLE_DATA && !owner) {
    return (
      <div className="well flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm">Connect a wallet to see what you hold and what it&rsquo;s worth at the floor.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={open}>
          Connect
        </button>
      </div>
    );
  }
  const loading = !SAMPLE_DATA && (!real || real.owner !== owner);
  const holdings = SAMPLE_DATA ? sample : (real?.holdings ?? []);
  if (!SAMPLE_DATA && (loading || holdings.length === 0)) {
    return (
      <div className="well px-4 py-6 text-sm">
        {loading ? "Reading your wallet…" : real?.error ? real.error : (
          <>
            No Strata tokens in this wallet yet.{" "}
            <Link href="/projects" className="font-semibold text-accent underline underline-offset-4">
              Browse the projects
            </Link>
            .
          </>
        )}
      </div>
    );
  }
  const atPrice = holdings.reduce((a, h) => a + h.amount * h.token.priceSol, 0);
  const atFloor = holdings.reduce((a, h) => a + h.amount * h.token.floorSol, 0);

  return (
    <div className="grid grid-cols-1 gap-6">
      {(SAMPLE_DATA || !publicKey) && (
        <div className="well flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm">
            <strong className="font-semibold">Example holdings.</strong>{" "}
            {SAMPLE_DATA
              ? publicKey
                ? "Your wallet is connected, but reading its balances arrives with the programs."
                : "Reading wallet balances arrives with the programs."
              : "Connect a wallet to see yours."}
          </p>
          {!publicKey && (
            <button type="button" className="btn btn-primary btn-sm" onClick={open}>
              Connect
            </button>
          )}
        </div>
      )}

      <Panel title={SAMPLE_DATA ? "Example holdings" : mode === "redeem" ? "What your tokens are worth at the floor" : "Your holdings"} titleId="holdings-title">
        <StatGrid min={150} className="mb-5">
          <Stat size={24} label="Value at price" value={formatSol(atPrice)} />
          <Stat size={24} label="Value at floor" value={formatSol(atFloor)} tone="accent" hint="what the vaults pay today" />
          <Stat size={24} label="Floor / price" value={formatPct(atFloor / atPrice, 0)} />
        </StatGrid>
        <div className="relative -mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Holdings</caption>
            <thead>
              <tr className="font-mono text-xs text-muted">
                <th scope="col" className="py-2 pr-3 pl-4 text-left font-medium sm:pl-5">
                  Token
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Balance
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Floor
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  At floor
                </th>
                <th scope="col" className="py-2 pr-4 pl-3 sm:pr-5">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.token.mint} className="border-t border-rule">
                  <th scope="row" className="py-3 pr-3 pl-4 text-left font-normal sm:pl-5">
                    <Link href={`/token/${h.token.mint}`} className="inline-flex items-center gap-3 no-underline">
                      <TokenGlyph ticker={h.token.ticker} hue={h.token.hue} size={36} />
                      <span className="grid">
                        <span className="font-semibold">{h.token.name}</span>
                        <span className="font-mono text-xs text-muted">{h.token.ticker}</span>
                      </span>
                    </Link>
                  </th>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCompact(h.amount)}</td>
                  <td className="px-3 py-3 text-right font-mono text-accent tabular-nums">
                    <SolPrice value={h.token.floorSol} unit={false} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums">{formatSol(h.amount * h.token.floorSol)}</td>
                  <td className="py-3 pr-4 pl-3 text-right sm:pr-5">
                    <Link
                      href={`/token/${h.token.mint}${mode === "redeem" ? "?tab=redeem" : ""}`}
                      className={btn(mode === "redeem" ? "ink" : "secondary", "sm")}
                    >
                      {mode === "redeem" ? "Redeem" : "Trade"}
                      <IconArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
