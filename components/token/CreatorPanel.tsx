"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { IconArrowUpRight } from "@/components/icons";
import { useNow, useStrataSigner } from "@/components/wallet/useStrata";
import { explorerUrl, SAMPLE_DATA } from "@/lib/config";
import type { TokenSummary } from "@/lib/data/types";
import { formatCompact, formatSol, shortAddress } from "@/lib/format";
import { claimCreatorFees, claimVested, type TxResult } from "@/lib/strata/actions";
import { pdas } from "@/lib/strata/client";

/** Shown only to the launch's creator: claim creator fees and vested tokens. */
export function CreatorPanel({ token }: { token: TokenSummary }) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const signer = useStrataSigner();
  const router = useRouter();
  const [feesSol, setFeesSol] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: TxResult; err?: string } | null>(null);
  const isCreator = !!publicKey && publicKey.toBase58() === token.creator;
  const now = useNow();

  useEffect(() => {
    if (!isCreator || SAMPLE_DATA) return;
    let cancelled = false;
    (async () => {
      const vault = pdas(new PublicKey(token.mint)).creatorFees;
      const [lamports, rent] = await Promise.all([connection.getBalance(vault), connection.getMinimumBalanceForRentExemption(8)]);
      if (!cancelled) setFeesSol(Math.max(0, lamports - rent) / 1e9);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCreator, connection, token.mint, msg]);

  if (!isCreator || !signer) return null;

  const v = token.vest;
  const vestedNow = v ? (v.totalTokens * Math.min(Math.max(now - v.start, 0), v.days * 86_400_000)) / (v.days * 86_400_000) : 0;
  const claimable = v ? Math.max(0, vestedNow - v.claimedTokens) : 0;

  const run = async (label: string, fn: () => Promise<TxResult>) => {
    setBusy(label);
    setMsg(null);
    try {
      const ok = await fn();
      setMsg({ ok });
      router.refresh();
    } catch (e) {
      setMsg({ err: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="raised grid gap-3 px-4 py-3.5" aria-labelledby="creator-title">
      <p id="creator-title" className="type-title">
        You launched this
      </p>
      <dl className="quote">
        <div>
          <dt>Creator fees to claim</dt>
          <dd>{feesSol === null ? "…" : formatSol(feesSol, { compact: false })}</dd>
        </div>
        {v && (
          <div>
            <dt>Vested, unclaimed</dt>
            <dd>
              {formatCompact(claimable)} of {formatCompact(v.totalTokens)}
            </dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy || !feesSol} onClick={() => run("fees", () => claimCreatorFees(signer, token.mint))}>
          {busy === "fees" ? "Waiting…" : "Claim fees"}
        </button>
        {v && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy || claimable <= 0} onClick={() => run("vest", () => claimVested(signer, token.mint))}>
            {busy === "vest" ? "Waiting…" : "Claim vested tokens"}
          </button>
        )}
      </div>
      <div aria-live="polite">
        {msg?.ok && !msg.ok.simulated && (
          <a href={explorerUrl("tx", msg.ok.signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs underline underline-offset-2">
            Confirmed {shortAddress(msg.ok.signature, 6)} <IconArrowUpRight size={12} />
          </a>
        )}
        {msg?.ok?.simulated && <p className="font-mono text-xs text-muted">Simulated: the programs aren&rsquo;t deployed yet.</p>}
        {msg?.err && <p className="text-sm font-semibold text-rust">{msg.err}</p>}
      </div>
    </section>
  );
}
