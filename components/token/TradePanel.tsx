"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconArrowUpRight, IconBurn } from "@/components/icons";
import { cx, SolPrice } from "@/components/ui";
import { useBalances, useNow, useStrataSigner } from "@/components/wallet/useStrata";
import { useWalletDialog } from "@/components/wallet/WalletProviders";
import { explorerUrl } from "@/lib/config";
import type { TokenSummary } from "@/lib/data/types";
import { curveInventory, floorOf, MIN_CIRCULATING, quoteBuy, quoteExit, redeem, type PoolState } from "@/lib/floor";
import { LIMITS } from "@/lib/limits";
import { formatCompact, formatNumber, formatPct, formatSol, shortAddress } from "@/lib/format";
import { buy, redeemAtFloor, sell, type StrataSigner, type TxResult } from "@/lib/strata/actions";

type Tab = "buy" | "sell" | "redeem";
const TABS: { key: Tab; label: string }[] = [
  { key: "buy", label: "Buy" },
  { key: "sell", label: "Sell" },
  { key: "redeem", label: "Redeem at floor" },
];
const SLIPPAGE = LIMITS.trade.defaultSlippageBps / 10_000;
const REDEMPTION_HOLD = `Leaves less than ${MIN_CIRCULATING.toLocaleString("en-US")} tokens in circulation. Redeem a little less, or all of it.`;

export function TradePanel({ token, asOf, initialTab = "buy" }: { token: TokenSummary; asOf: number; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const ids = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pool: PoolState = useMemo(
    () => ({
      ...token.curve,
      reserveSol: token.reserveSol,
      pendingSol: token.pendingSol ?? 0,
      circulating: token.circulating,
      floorHwm: token.floorHwm ?? token.floorSol,
      settings: token.settings,
    }),
    [token],
  );

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + TABS.length) % TABS.length;
    setTab(TABS[n].key);
    tabRefs.current[n]?.focus();
  };

  return (
    <section className="raised min-w-0" aria-label={`Trade ${token.ticker}`}>
      <div role="tablist" aria-label="Trade" className="grid grid-cols-[1fr_1fr_1.6fr] border-b border-rule-strong">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`${ids}-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-controls={`${ids}-panel`}
            tabIndex={tab === t.key ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => setTab(t.key)}
            className={cx(
              "relative h-12 px-2 text-[15px] font-semibold whitespace-nowrap",
              tab === t.key ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent after:content-['']" : "text-muted hover:text-ink",
              i > 0 && "border-l border-rule",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${tab}`} className="p-4 sm:p-5">
        {tab === "buy" && <BuyForm key="buy" token={token} pool={pool} />}
        {tab === "sell" && <SellForm key="sell" token={token} pool={pool} asOf={asOf} />}
        {tab === "redeem" && <RedeemForm key="redeem" token={token} pool={pool} asOf={asOf} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function useTokenBalance(token: TokenSummary) {
  return useBalances(token.mint, Math.round(token.circulating * 0.004));
}

function balanceLabel(amount: string, demo: boolean) {
  return `Balance ${amount}${demo ? " (demo)" : ""}`;
}

function redemptionOpensAt(token: TokenSummary) {
  return token.redemptionOpensAt ?? token.createdAt + token.settings.redemptionDelayHours * 3_600_000;
}

function AmountField({
  label,
  unit,
  value,
  onChange,
  aside,
  presets,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  aside?: ReactNode;
  presets: { label: string; value: string }[];
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {aside && <span className="field-aside">{aside}</span>}
      </div>
      <div className="input">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          className="font-mono text-lg font-semibold tabular-nums"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        <span className="input-affix">{unit}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.label} type="button" className="btn btn-secondary btn-sm h-7! px-2! font-mono text-xs!" onClick={() => onChange(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Submit({
  label,
  disabled,
  variant = "primary",
  run,
  note,
  onDone,
}: {
  label: ReactNode;
  disabled?: boolean;
  variant?: "primary" | "ink";
  run: (signer: StrataSigner) => Promise<TxResult>;
  note?: ReactNode;
  onDone?: () => void;
}) {
  const signer = useStrataSigner();
  const router = useRouter();
  const { open } = useWalletDialog();
  const [state, setState] = useState<{ busy?: boolean; ok?: TxResult; err?: string }>({});
  if (!signer) {
    return (
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={open}>
        Connect a wallet
      </button>
    );
  }
  return (
    <div className="grid gap-2.5">
      <button
        type="button"
        className={cx("btn btn-lg btn-block", variant === "ink" ? "btn-ink" : "btn-primary")}
        disabled={disabled || state.busy}
        onClick={async () => {
          setState({ busy: true });
          try {
            const ok = await run(signer);
            setState({ ok });
            if (!ok.simulated) {
              onDone?.();
              router.refresh();
            }
          } catch (e) {
            setState({ err: e instanceof Error ? e.message : "Something went wrong." });
          }
        }}
      >
        {state.busy ? "Waiting for signature…" : label}
      </button>
      {note}
      <div aria-live="polite" className="min-h-0">
        {state.ok && (
          <p className="rounded-[4px] bg-[var(--accent-soft)] px-3 py-2 font-mono text-xs leading-5">
            {state.ok.simulated ? (
              <>
                Sent {shortAddress(state.ok.signature, 6)}
                <span className="block text-muted">Simulated: the programs aren&rsquo;t deployed yet.</span>
              </>
            ) : (
              <a href={explorerUrl("tx", state.ok.signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                Confirmed {shortAddress(state.ok.signature, 6)} <IconArrowUpRight size={12} />
              </a>
            )}
          </p>
        )}
        {state.err && <p className="rounded-[4px] bg-[var(--accent-2-soft)] px-3 py-2 text-sm font-semibold text-rust">{state.err}</p>}
      </div>
    </div>
  );
}

function FloorDelta({ before, after }: { before: number; after: number }) {
  const up = after > before * (1 + 1e-9);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <SolPrice value={after} unit={false} />
      <span className={cx("text-xs", up ? "text-accent" : "text-muted")}>{up ? `+${formatPct(after / before - 1, 3)}` : "same"}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

function BuyForm({ token, pool }: { token: TokenSummary; pool: PoolState }) {
  const [amt, setAmt] = useState("1");
  const { balance: bal, refresh } = useTokenBalance(token);
  const sol = Number(amt) || 0;
  const q = quoteBuy(pool, sol);
  const tooSmall = sol > 0 && sol < LIMITS.trade.minBuySol;
  const left = curveInventory(pool);
  const overCap = q.tokensOut > left;
  return (
    <div className="grid gap-4">
      <AmountField
        label="You pay"
        unit="SOL"
        value={amt}
        onChange={setAmt}
        aside={bal ? balanceLabel(formatSol(bal.sol), bal.demo) : undefined}
        presets={["0.1", "0.5", "1", "5"].map((v) => ({ label: `${v} SOL`, value: v }))}
      />
      <dl className="quote">
        <div>
          <dt>You receive</dt>
          <dd>
            {formatCompact(q.tokensOut)} {token.ticker}
          </dd>
        </div>
        <div>
          <dt>You pay per token</dt>
          <dd>
            <SolPrice value={q.avgPrice} unit={false} />
            {q.priceAfter > 0 && <span className="ml-1.5 text-xs text-muted">{(q.avgPrice / Math.max(pool.virtualSol / pool.virtualTokens, 1e-18)).toFixed(2)}× spot</span>}
          </dd>
        </div>
        <div>
          <dt>Into the reserve</dt>
          <dd className="text-accent">{formatSol(q.deposit + q.reserveFee)}</dd>
        </div>
        <div>
          <dt>Creator fee</dt>
          <dd>{formatSol(q.creatorFee)}</dd>
        </div>
        <div>
          <dt>Price after</dt>
          <dd>
            <SolPrice value={q.priceAfter} unit={false} />
          </dd>
        </div>
        <div className="total">
          <dt>Floor after</dt>
          <dd>
            <FloorDelta before={q.floorBefore} after={q.floorAfter} />
          </dd>
        </div>
      </dl>
      <Submit
        label={`Buy ${token.ticker}`}
        disabled={sol <= 0 || tooSmall || !q.ok || overCap || (!!bal && !bal.demo && sol > bal.sol)}
        run={(s) => buy(s, token.mint, sol, q.tokensOut * (1 - SLIPPAGE))}
        onDone={refresh}
        note={
          left <= 0 ? (
            <p className="text-xs font-semibold text-rust">Curve complete: all {formatCompact(LIMITS.token.maxSupplyTokens)} tokens are out. Sell or redeem instead.</p>
          ) : overCap ? (
            <p className="text-xs font-semibold text-rust">Only {formatCompact(left)} tokens are left on the curve. Buy a little less.</p>
          ) : tooSmall ? (
            <p className="text-xs font-semibold text-rust">The smallest buy is {LIMITS.trade.minBuySol} SOL.</p>
          ) : (
            <p className="text-xs text-muted">
              {LIMITS.trade.defaultSlippageBps / 100}% slippage limit.{" "}
              {q.toppedUp
                ? "Price is close to the floor, so more of this buy goes to the reserve: every new token is backed at the floor."
                : "Every new token is backed at the floor or better."}
            </p>
          )
        }
      />
    </div>
  );
}

function SellForm({ token, pool, asOf }: { token: TokenSummary; pool: PoolState; asOf: number }) {
  const { balance: bal, refresh } = useTokenBalance(token);
  const [amt, setAmt] = useState("1000000");
  const tokens = Number(amt) || 0;
  const now = useNow();
  const redemptionOpen = Math.max(asOf, now) >= redemptionOpensAt(token);
  const q = quoteExit(pool, tokens, redemptionOpen);
  const max = bal?.tokens ?? 0;
  return (
    <div className="grid gap-4">
      <AmountField
        label="You sell"
        unit={token.ticker}
        value={amt}
        onChange={setAmt}
        aside={bal ? balanceLabel(formatCompact(max), bal.demo) : undefined}
        presets={
          bal && max > 0
            ? [0.25, 0.5, 1].map((f) => ({ label: f === 1 ? "Max" : `${f * 100}%`, value: String(f === 1 ? max : Math.floor(max * f)) }))
            : ["1M", "10M", "50M"].map((l) => ({ label: l, value: String(parseInt(l) * 1e6) }))
        }
      />
      <dl className="quote">
        <div>
          <dt>Sold on the curve</dt>
          <dd>
            {formatCompact(q.toCurve)} → {formatSol(q.solFromCurve)}
          </dd>
        </div>
        <div>
          <dt>Redeemed at floor</dt>
          <dd>
            {formatCompact(q.toRedeem)} → {formatSol(q.solFromRedeem)}
          </dd>
        </div>
        <div>
          <dt>Fees</dt>
          <dd>{formatSol(q.fees)}</dd>
        </div>
        <div className="total">
          <dt>You receive</dt>
          <dd>{formatSol(q.solOut)}</dd>
        </div>
        <div>
          <dt>Floor after</dt>
          <dd>
            <FloorDelta before={q.floorBefore} after={q.floorAfter} />
          </dd>
        </div>
      </dl>
      <Submit
        label={`Sell ${token.ticker}`}
        disabled={tokens <= 0 || !q.ok || (!!bal && !bal.demo && tokens > bal.tokens)}
        run={(s) => sell(s, token.mint, tokens, q.solOut * (1 - SLIPPAGE))}
        onDone={refresh}
        note={
          q.blocked ? (
            <p className="text-xs font-semibold text-rust">
              Redemption isn&rsquo;t open yet, so only {formatCompact(q.toCurve)} can go to the curve above the floor.
            </p>
          ) : !q.ok ? (
            <p className="text-xs font-semibold text-rust">{REDEMPTION_HOLD}</p>
          ) : (
            <p className="text-xs text-muted">
              Sells go to the curve only while it pays more than the floor, after fees. Anything past that is redeemed at the floor in
              the same transaction.
            </p>
          )
        }
      />
    </div>
  );
}

function RedeemForm({ token, pool, asOf }: { token: TokenSummary; pool: PoolState; asOf: number }) {
  const { balance: bal, refresh } = useTokenBalance(token);
  const [amt, setAmt] = useState("1000000");
  const tokens = Number(amt) || 0;
  const r = redeem(pool, tokens);
  const opensAt = redemptionOpensAt(token);
  const now = useNow();
  const open = Math.max(asOf, now) >= opensAt;
  const max = bal?.tokens ?? 0;
  return (
    <div className="grid gap-4">
      <div className="slab grid gap-1 px-4 py-3">
        <p className="font-mono text-xs opacity-75">Floor, paid from the vault</p>
        <p className="font-mono text-2xl leading-tight font-semibold">
          <SolPrice value={floorOf(pool)} unit={false} />
          <span className="text-sm opacity-75"> SOL / token</span>
        </p>
        <p className="font-mono text-xs opacity-75">{formatSol(floorOf(pool) * 1e6)} per 1M tokens</p>
      </div>
      <AmountField
        label="You redeem"
        unit={token.ticker}
        value={amt}
        onChange={setAmt}
        aside={bal ? balanceLabel(formatCompact(max), bal.demo) : undefined}
        presets={
          bal && max > 0
            ? [0.25, 0.5, 1].map((f) => ({ label: f === 1 ? "Max" : `${f * 100}%`, value: String(f === 1 ? max : Math.floor(max * f)) }))
            : ["1M", "10M", "50M"].map((l) => ({ label: l, value: String(parseInt(l) * 1e6) }))
        }
      />
      <dl className="quote">
        <div>
          <dt className="inline-flex items-center gap-1.5 text-rust">
            <IconBurn size={14} /> Burned
          </dt>
          <dd className="text-rust">
            {formatNumber(r.amount)} {token.ticker}
          </dd>
        </div>
        <div className="total">
          <dt>You receive</dt>
          <dd>{formatSol(r.payoutSol, { compact: false })}</dd>
        </div>
        <div>
          <dt>Floor after</dt>
          <dd>
            <FloorDelta before={r.floorBefore} after={r.floorAfter} />
          </dd>
        </div>
      </dl>
      <Submit
        variant="ink"
        label="Redeem at the floor"
        disabled={!open || tokens <= 0 || !r.ok || (!!bal && !bal.demo && tokens > bal.tokens)}
        run={(s) => redeemAtFloor(s, token.mint, tokens, r.payoutSol)}
        onDone={refresh}
        note={
          open && !r.ok ? (
            <p className="text-xs font-semibold text-rust">{REDEMPTION_HOLD}</p>
          ) : open ? (
            <p className="text-xs text-muted">No fee. Payout rounds down to the lamport; the dust stays in the vault.</p>
          ) : (
            <p className="text-xs font-semibold text-rust">
              Redemption opens {new Date(opensAt).toUTCString().slice(5, 22)} UTC, {token.settings.redemptionDelayHours}h after launch.
            </p>
          )
        }
      />
    </div>
  );
}
