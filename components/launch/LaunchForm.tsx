"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { IconArrowRight, IconImage } from "@/components/icons";
import { FloorGauge } from "@/components/token/Spark";
import { TokenCard } from "@/components/token/TokenCard";
import { cx, Panel, SolPrice } from "@/components/ui";
import { useWalletDialog } from "@/components/wallet/WalletProviders";
import { freshPool, quoteBuy, startingFloor, type LaunchSettings } from "@/lib/floor";
import { formatBps, formatCompact, formatPct, formatSol, shortAddress } from "@/lib/format";
import { bpsToPct, LIMITS } from "@/lib/limits";
import { launchToken } from "@/lib/strata/actions";

const L = LIMITS.settings;
const T = LIMITS.token;
const LAUNCH_FEE_SOL = LIMITS.launch.launchFeeSol;
const MAX_IMAGE = T.imageMaxBytes;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const DELAYS = L.redemptionDelayHours.options.map((h) => ({
  h,
  label: h === 0 ? "From the first block" : h < 24 ? `After ${h} hour${h === 1 ? "" : "s"}` : h === 24 ? "After 24 hours" : `After ${h / 24} days`,
}));
const pctRange = (r: { min: number; max: number }) => ({ min: bpsToPct(r.min), max: bpsToPct(r.max) });
const RESERVE = pctRange(L.reserveShareBps);
const FEE = pctRange(L.feeToReserveBps);
const CREATOR = pctRange(L.creatorFeeBps);
const TICKER_RE = new RegExp(`^[A-Z0-9]{${T.tickerMinChars},${T.tickerMaxChars}}$`);

type Step = 1 | 2 | 3;
interface Draft {
  name: string;
  ticker: string;
  description: string;
  image: File | null;
  reservePct: number;
  feePct: number;
  creatorPct: number;
  delayH: number;
  firstBuySol: number;
  vest: boolean;
  vestDays: number;
}

const initial: Draft = {
  name: "",
  ticker: "",
  description: "",
  image: null,
  reservePct: bpsToPct(L.reserveShareBps.default),
  feePct: bpsToPct(L.feeToReserveBps.default),
  creatorPct: bpsToPct(L.creatorFeeBps.default),
  delayH: L.redemptionDelayHours.default,
  firstBuySol: LIMITS.launch.firstBuyDefaultSol,
  vest: true,
  vestDays: L.vestingDays.default,
};

function validate(d: Draft, step: Step): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  if (step >= 1) {
    if (!d.name.trim()) e.name = "Give the token a name.";
    else if (d.name.length > T.nameMaxChars) e.name = `${T.nameMaxChars} characters at most.`;
    if (!TICKER_RE.test(d.ticker)) e.ticker = `${T.tickerMinChars} to ${T.tickerMaxChars} letters or digits.`;
    if (d.image && !IMAGE_TYPES.includes(d.image.type)) e.image = "Use PNG, JPG, GIF or WebP.";
    else if (d.image && d.image.size > MAX_IMAGE) e.image = `${MAX_IMAGE / 1024 / 1024} MB at most.`;
  }
  if (step >= 2) {
    const out = (v: number, r: { min: number; max: number }) => v < r.min || v > r.max;
    if (out(d.reservePct, RESERVE)) e.reservePct = `Between ${RESERVE.min}% and ${RESERVE.max}%.`;
    if (out(d.feePct, FEE)) e.feePct = `Between ${FEE.min}% and ${FEE.max}%.`;
    if (out(d.creatorPct, CREATOR)) e.creatorPct = `Between ${CREATOR.min}% and ${CREATOR.max}%.`;
    if (d.firstBuySol < 0 || d.firstBuySol > LIMITS.launch.firstBuyMaxSol) e.firstBuySol = `Up to ${LIMITS.launch.firstBuyMaxSol} SOL.`;
    else if (d.firstBuySol > 0 && d.firstBuySol < LIMITS.trade.minBuySol) e.firstBuySol = `At least ${LIMITS.trade.minBuySol} SOL, or 0 to skip.`;
    if (d.vest && out(d.vestDays, L.vestingDays)) e.vestDays = `Between ${L.vestingDays.min} and ${L.vestingDays.max} days.`;
  }
  return e;
}

export function toSettings(d: Draft): LaunchSettings {
  return {
    reserveShareBps: Math.round(d.reservePct * 100),
    feeToReserveBps: Math.round(d.feePct * 100),
    creatorFeeBps: Math.round(d.creatorPct * 100),
    vestingDays: d.vest && d.firstBuySol > 0 ? d.vestDays : null,
    redemptionDelayHours: d.delayH,
  };
}

export function LaunchForm() {
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState<Step>(1);
  const [tried, setTried] = useState<Set<Step>>(new Set());
  const [result, setResult] = useState<{ busy?: boolean; mint?: string; sig?: string; err?: string }>({});
  const { publicKey } = useWallet();
  const { open } = useWalletDialog();
  const mainRef = useRef<HTMLDivElement>(null);

  const preview = useMemo(() => (d.image ? URL.createObjectURL(d.image) : null), [d.image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const errors = validate(d, step);
  const shownErrors = tried.has(step) ? errors : {};
  const settings = toSettings(d);
  const start = startingFloor(settings, d.firstBuySol);
  const firstBuy = d.firstBuySol > 0 ? quoteBuy(freshPool(settings), d.firstBuySol) : null;

  const go = (next: Step) => {
    if (next > step) {
      setTried((t) => new Set(t).add(step));
      if (Object.keys(validate(d, step)).length) return;
    }
    setStep(next);
    // Move focus to the new step's heading once it renders.
    requestAnimationFrame(() => mainRef.current?.querySelector<HTMLElement>("h2 [tabindex]")?.focus());
  };

  const submit = async () => {
    if (!publicKey) return open();
    setResult({ busy: true });
    try {
      const r = await launchToken(
        { publicKey },
        { name: d.name.trim(), ticker: d.ticker, description: d.description.trim(), image: d.image, settings, firstBuySol: d.firstBuySol },
      );
      setResult({ mint: r.mint, sig: r.signature });
    } catch (e) {
      setResult({ err: e instanceof Error ? e.message : "The launch failed." });
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 3) go((step + 1) as Step);
        else void submit();
      }}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]"
    >
      <nav aria-label="Launch steps" className="justify-self-center lg:col-start-1 lg:row-start-1">
        <ol className="flex flex-wrap justify-center gap-2">
          {(["Token", "Floor", "Review"] as const).map((label, i) => {
            const n = (i + 1) as Step;
            const current = n === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  aria-current={current ? "step" : undefined}
                  className={cx("btn", current ? "btn-ink" : "btn-secondary", "gap-2 max-sm:px-3")}
                  onClick={() => go(n)}
                >
                  <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-[3px] bg-[color-mix(in_srgb,currentColor_16%,transparent)] px-1 font-mono text-xs">
                    {n}
                  </span>
                  <span className="sr-only">Step </span>
                  <span className={cx(!current && "max-sm:sr-only")}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={mainRef} className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-2">
        {step === 1 && (
          <Panel title={<span tabIndex={-1} className="outline-none">The token</span>} titleId="step-token">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-start">
              <ImageDrop file={d.image} preview={preview} error={shownErrors.image} onFile={(f) => set("image", f)} />
              <div className="grid content-start gap-5">
                <Field label="Name" aside={`${d.name.length} / ${T.nameMaxChars}`} error={shownErrors.name}>
                  {(id, describedBy) => (
                    <div className="input" data-invalid={shownErrors.name ? "" : undefined}>
                      <input id={id} aria-describedby={describedBy} maxLength={T.nameMaxChars} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Basalt" autoComplete="off" />
                    </div>
                  )}
                </Field>
                <Field label="Ticker" aside={`${d.ticker.length} / ${T.tickerMaxChars}`} error={shownErrors.ticker}>
                  {(id, describedBy) => (
                    <div className="input" data-invalid={shownErrors.ticker ? "" : undefined}>
                      <input
                        id={id}
                        aria-describedby={describedBy}
                        className="font-mono uppercase"
                        maxLength={T.tickerMaxChars}
                        value={d.ticker}
                        onChange={(e) => set("ticker", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                        placeholder="BSLT"
                        autoComplete="off"
                      />
                    </div>
                  )}
                </Field>
              </div>
            </div>
            <div className="mt-5">
              <Field label="Description" aside={`${d.description.length} / ${T.descriptionMaxChars.toLocaleString("en-US")}`}>
                {(id) => (
                  <div className="input">
                    <textarea id={id} maxLength={T.descriptionMaxChars} value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="What it is, and why it has a floor." />
                  </div>
                )}
              </Field>
            </div>
          </Panel>
        )}

        {step === 2 && (
          <Panel
            title={<span tabIndex={-1} className="outline-none">The floor</span>}
            titleId="step-floor"
            note="These are written into the launch and can't be changed afterwards."
          >
            <div className="grid gap-6">
              <SliderField
                label="Reserve share"
                help="Share of each buy, after fees, that goes into the vault before the curve sees it."
                value={d.reservePct}
                min={RESERVE.min}
                max={RESERVE.max}
                step={1}
                unit="%"
                error={shownErrors.reservePct}
                onChange={(v) => set("reservePct", v)}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <SliderField
                  label="Fee to reserve"
                  help="On every buy and sell. Raises the floor each time."
                  value={d.feePct}
                  min={FEE.min}
                  max={FEE.max}
                  step={0.05}
                  unit="%"
                  error={shownErrors.feePct}
                  onChange={(v) => set("feePct", v)}
                />
                <SliderField
                  label="Creator fee"
                  help="On every buy and sell, to your wallet. Never from the reserve."
                  value={d.creatorPct}
                  min={CREATOR.min}
                  max={CREATOR.max}
                  step={0.05}
                  unit="%"
                  error={shownErrors.creatorPct}
                  onChange={(v) => set("creatorPct", v)}
                />
              </div>
              <Field label="Redemption opens" help="A short wait stops snipers redeeming the opening buys straight back.">
                {(id, describedBy) => (
                  <div className="input">
                    <select id={id} aria-describedby={describedBy} value={d.delayH} onChange={(e) => set("delayH", Number(e.target.value))} className="cursor-pointer">
                      {DELAYS.map((o) => (
                        <option key={o.h} value={o.h}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </Field>
              <fieldset className="hairline-top grid gap-5 pt-5">
                <legend className="sr-only">Your first buy</legend>
                <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
                  <Field label="Your first buy" aside="Optional" help="Sets the starting floor. 0 to skip." error={shownErrors.firstBuySol}>
                    {(id, describedBy) => (
                      <div className="input" data-invalid={shownErrors.firstBuySol ? "" : undefined}>
                        <input
                          id={id}
                          aria-describedby={describedBy}
                          inputMode="decimal"
                          className="font-mono tabular-nums"
                          value={String(d.firstBuySol)}
                          onChange={(e) => set("firstBuySol", Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
                        />
                        <span className="input-affix">SOL</span>
                      </div>
                    )}
                  </Field>
                  <div className="grid gap-2">
                    <label className="flex h-[19.5px] cursor-pointer items-center gap-2.5 text-[15px] leading-[1.3] font-semibold">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent)]"
                        checked={d.vest}
                        disabled={d.firstBuySol <= 0}
                        onChange={(e) => set("vest", e.target.checked)}
                      />
                      Vest my first buy
                    </label>
                    <div className={cx("input", (!d.vest || d.firstBuySol <= 0) && "opacity-50")} data-invalid={shownErrors.vestDays ? "" : undefined}>
                      <input
                        aria-label="Vesting days"
                        inputMode="numeric"
                        className="font-mono tabular-nums"
                        disabled={!d.vest || d.firstBuySol <= 0}
                        value={String(d.vestDays)}
                        onChange={(e) => set("vestDays", Number(e.target.value.replace(/\D/g, "")) || 0)}
                      />
                      <span className="input-affix">days</span>
                    </div>
                    <p className={cx("text-sm", shownErrors.vestDays ? "font-semibold text-rust" : "text-muted")}>
                      {shownErrors.vestDays ?? "Unlocks a little each day. Buyers see this on your card."}
                    </p>
                  </div>
                </div>
              </fieldset>
            </div>
          </Panel>
        )}

        {step === 3 && (
          <Panel title={<span tabIndex={-1} className="outline-none">Review and launch</span>} titleId="step-review" note="Check every line. Once it's live, nobody can change these, including you.">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 font-mono text-xs font-semibold text-muted">Token</p>
                <dl className="quote">
                  <div>
                    <dt>Name</dt>
                    <dd className="font-sans! font-semibold">{d.name}</dd>
                  </div>
                  <div>
                    <dt>Ticker</dt>
                    <dd>{d.ticker}</dd>
                  </div>
                  <div>
                    <dt>Picture</dt>
                    <dd>{d.image ? "Added" : "Generated"}</dd>
                  </div>
                </dl>
                <p className="mt-5 mb-2 font-mono text-xs font-semibold text-muted">Floor rules</p>
                <dl className="quote">
                  <div>
                    <dt>Reserve share</dt>
                    <dd>{formatBps(settings.reserveShareBps)}</dd>
                  </div>
                  <div>
                    <dt>Fee to reserve</dt>
                    <dd>{formatBps(settings.feeToReserveBps)}</dd>
                  </div>
                  <div>
                    <dt>Creator fee</dt>
                    <dd>{settings.creatorFeeBps ? formatBps(settings.creatorFeeBps) : "None"}</dd>
                  </div>
                  <div>
                    <dt>Redemption</dt>
                    <dd>{DELAYS.find((o) => o.h === d.delayH)?.label}</dd>
                  </div>
                  <div>
                    <dt>Vesting</dt>
                    <dd>{settings.vestingDays ? `${settings.vestingDays} days` : "Off"}</dd>
                  </div>
                  <div className="total">
                    <dt>Fees per trade</dt>
                    <dd>{formatBps(settings.feeToReserveBps + settings.creatorFeeBps)}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <p className="mb-2 font-mono text-xs font-semibold text-muted">Paid now</p>
                <dl className="quote">
                  <div>
                    <dt>Launch fee</dt>
                    <dd>{LAUNCH_FEE_SOL} SOL + rent</dd>
                  </div>
                  <div>
                    <dt>Your first buy</dt>
                    <dd>{d.firstBuySol > 0 ? formatSol(d.firstBuySol, { compact: false }) : "None"}</dd>
                  </div>
                  {firstBuy && (
                    <div>
                      <dt>You receive</dt>
                      <dd>
                        {formatCompact(firstBuy.tokensOut)} {d.ticker}
                      </dd>
                    </div>
                  )}
                  <div className="total">
                    <dt>Total</dt>
                    <dd>{formatSol(LAUNCH_FEE_SOL + d.firstBuySol, { compact: false })} + rent</dd>
                  </div>
                </dl>
                <div className="slab mt-5 grid gap-1.5 px-4 pt-3 pb-4">
                  <p className="justify-self-start rounded-[4px] bg-[color-mix(in_srgb,currentColor_16%,transparent)] px-2 py-[3px] font-mono text-xs font-semibold">Never</p>
                  <p className="font-display text-lg leading-[1.1] font-extrabold [font-stretch:84%]">A withdrawal from the reserve, by anyone. Including you.</p>
                </div>
              </div>
            </div>
            <div aria-live="polite" className="mt-5">
              {result.mint && (
                <div className="rounded-[6px] border border-accent bg-[var(--accent-soft)] px-4 py-3">
                  <p className="font-semibold">Launch sent.</p>
                  <p className="mt-1 font-mono text-xs leading-5">
                    mint {shortAddress(result.mint, 6)} · sig {shortAddress(result.sig ?? "", 6)}
                    <span className="block text-muted">Simulated: the programs aren&rsquo;t deployed yet, so nothing went on chain.</span>
                  </p>
                </div>
              )}
              {result.err && <p className="rounded-[4px] bg-[var(--accent-2-soft)] px-3 py-2 text-sm font-semibold text-rust">{result.err}</p>}
            </div>
          </Panel>
        )}

        <div className="flex items-center justify-between gap-3">
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={() => go((step - 1) as Step)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button type="submit" className="btn btn-ink">
              {step === 1 ? "Next: the floor" : "Next: review"}
              <IconArrowRight size={18} />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-lg" disabled={result.busy || !!result.mint}>
              {!publicKey ? "Connect to launch" : result.busy ? "Waiting for signature…" : "Sign and launch"}
            </button>
          )}
        </div>
      </div>

      <aside
        aria-label="What buyers will see"
        className="grid min-w-0 gap-6 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:col-start-2 lg:row-start-2 lg:self-start"
      >
        <figure className="m-0 mx-auto w-full max-w-[26rem] min-w-0 lg:max-w-none">
          <figcaption className="mb-2 font-mono text-xs font-semibold text-muted">Your card on the board</figcaption>
          <TokenCard
            token={{
              name: d.name,
              ticker: d.ticker,
              hue: hashHue(d.ticker || d.name),
              image: preview,
              status: "draft",
              priceSol: start.priceAfter,
              floorSol: start.floor,
              reserveSol: firstBuy ? firstBuy.after.reserveSol : 0,
              settings,
            }}
          />
        </figure>
        <section className="raised mx-auto w-full max-w-[26rem] px-4 pt-3.5 pb-4 lg:max-w-none" aria-labelledby="start-floor-title">
          <p id="start-floor-title" className="type-title">
            Starting floor
          </p>
          <p className="mt-1 text-sm text-muted">{d.firstBuySol > 0 ? `After your first buy of ${formatSol(d.firstBuySol, { compact: false })}.` : "Set by the first buyer. Shown here for 1 SOL."}</p>
          <p className="mt-3 font-mono text-[28px] leading-none font-semibold text-accent tabular-nums">
            <SolPrice value={start.floor} unit={false} />
          </p>
          <p className="mt-1 font-mono text-xs text-muted">{formatSol(start.floor * 1e6, { compact: false })} per 1M tokens</p>
          <FloorGauge ratio={start.floorShareOfPrice} className="mt-4" />
          <dl className="quote mt-3">
            <div>
              <dt>Price after first buy</dt>
              <dd>
                <SolPrice value={start.priceAfter} unit={false} />
              </dd>
            </div>
            <div>
              <dt>Every trade adds</dt>
              <dd className="text-accent">{formatBps(settings.feeToReserveBps)} to reserve</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-[1.5] text-muted">
            The floor starts near {formatPct(start.floorShareOfPrice, 0)} of the price and climbs with every fee. It never steps down.
          </p>
        </section>
      </aside>
    </form>
  );
}

function hashHue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return s ? h : 160;
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  aside,
  help,
  error,
  children,
}: {
  label: string;
  aside?: string;
  help?: string;
  error?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="grid min-w-0 content-start gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {aside && <span className="field-aside">{aside}</span>}
      </div>
      {children(id, help || error ? helpId : undefined)}
      {(error || help) && (
        <p id={helpId} className={error ? "text-sm font-semibold text-rust" : "field-help"}>
          {error ?? help}
        </p>
      )}
    </div>
  );
}

function SliderField({
  label,
  help,
  value,
  min,
  max,
  step,
  unit,
  error,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  error?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="font-mono text-lg font-semibold text-accent tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={`${id}-help`}
        aria-valuetext={`${value}${unit}`}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between font-mono text-[11px] text-muted" aria-hidden="true">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
      <p id={`${id}-help`} className={error ? "text-sm font-semibold text-rust" : "field-help"}>
        {error ?? help}
      </p>
    </div>
  );
}

function ImageDrop({ file, preview, error, onFile }: { file: File | null; preview: string | null; error?: string; onFile: (f: File | null) => void }) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <div className="grid content-start gap-2">
      <p className="field-label" id={`${id}-label`}>
        Picture
      </p>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFile(e.dataTransfer.files[0] ?? null);
        }}
        className={cx(
          "well relative grid aspect-square w-full max-w-[220px] cursor-pointer place-items-center overflow-hidden border-dashed text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
          over && "border-accent bg-[var(--accent-soft)]",
          error && "border-rust",
        )}
      >
        <input
          id={id}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="Your token picture" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="grid justify-items-center gap-2 px-4 text-sm font-semibold">
            <IconImage size={28} className="text-muted" />
            Drop a picture here, or press to choose one
          </span>
        )}
      </label>
      <div className="flex items-center justify-between gap-2">
        <p id={`${id}-hint`} className={error ? "text-sm font-semibold text-rust" : "field-help"}>
          {error ?? `PNG, JPG, GIF or WebP, ${MAX_IMAGE / 1024 / 1024} MB max. Square works best.`}
        </p>
        {file && (
          <button type="button" className="btn btn-ghost btn-sm flex-none" onClick={() => onFile(null)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
