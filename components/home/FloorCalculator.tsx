"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { cx, SolPrice } from "@/components/ui";
import { addToReserve, redeem } from "@/lib/floor";
import { formatNumber, formatPct, formatSol } from "@/lib/format";

const M = 1_000_000;

export function FloorCalculator() {
  const [reserve, setReserve] = useState(240);
  const [supplyM, setSupplyM] = useState(600);
  const [redeemM, setRedeemM] = useState(90);
  const [fee, setFee] = useState(12);

  const safeRedeemM = Math.min(redeemM, supplyM * 0.95);
  const s0 = { reserveSol: reserve, circulating: supplyM * M };
  const r = redeem(s0, safeRedeemM * M);
  const f = addToReserve(r.after, fee);
  const f0 = r.floorBefore;
  const f1 = r.floorAfter;
  const f2 = f.floorAfter;
  const rise = f1 > 0 ? f2 / f1 - 1 : 0;

  const states = [
    { n: 1, title: "Before", verdict: "Start", reserve: s0.reserveSol, supply: s0.circulating, floor: f0, tone: "flat" as const },
    {
      n: 2,
      title: `Redeem ${formatNumber(safeRedeemM)}M`,
      verdict: "Floor unchanged",
      reserve: r.after.reserveSol,
      supply: r.after.circulating,
      floor: f1,
      tone: "same" as const,
    },
    {
      n: 3,
      title: `Fee of ${formatSol(fee, { compact: false })}`,
      verdict: fee > 0 ? `Floor +${formatPct(rise, 2)}` : "No fee, no change",
      reserve: f.after.reserveSol,
      supply: f.after.circulating,
      floor: f2,
      tone: "up" as const,
    },
  ];

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <div className="grid content-start gap-5">
        <p className="font-mono text-xs font-semibold text-muted">Set the numbers</p>
        <RangeField label="Reserve" unit="SOL" value={reserve} min={1} max={1000} step={1} onChange={setReserve} />
        <RangeField label="Circulating supply" unit="M tokens" value={supplyM} min={10} max={1000} step={10} onChange={setSupplyM} />
        <RangeField
          label="Redeem"
          unit="M tokens"
          value={safeRedeemM}
          min={0}
          max={Math.floor(supplyM * 0.95)}
          step={1}
          onChange={setRedeemM}
        />
        <RangeField label="Fee into reserve" unit="SOL" value={fee} min={0} max={100} step={0.5} onChange={setFee} />
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <StepStrip floors={[f0, f1, f2]} />
        <ol className="grid gap-5 sm:grid-cols-3 sm:gap-x-5">
          {states.map((s) => (
            <li key={s.n} className="grid min-w-0 content-start">
              <div className="flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1 border-b-2 border-ink pb-2.5">
                <span className={cx("badge", s.tone === "flat" ? "badge-flat" : "badge-accent")}>{s.n}</span>
                <span className="font-display text-lg leading-[1.1] font-extrabold [font-stretch:84%]">{s.title}</span>
              </div>
              <p className="mt-3 font-mono text-xs font-medium text-muted">Floor per token</p>
              <p className="mt-1 font-mono text-[26px] leading-[1.1] font-semibold tracking-[-0.01em] tabular-nums" aria-live="polite">
                <SolPrice value={s.floor} unit={false} />
              </p>
              <p
                className={cx(
                  "mt-2 inline-flex h-6 w-fit items-center rounded-[4px] px-2 font-mono text-xs font-semibold",
                  s.tone === "flat" ? "bg-[var(--tint-soft)]" : "bg-[var(--accent-soft)] text-accent",
                )}
              >
                {s.verdict}
              </p>
              <dl className="quote mt-3">
                <div>
                  <dt>Reserve</dt>
                  <dd>{formatSol(s.reserve, { compact: false })}</dd>
                </div>
                <div>
                  <dt>Circulating</dt>
                  <dd>{formatNumber(s.supply / M, 1)}M</dd>
                </div>
                <div>
                  <dt>Per 1M tokens</dt>
                  <dd>{formatSol(s.floor * M, { compact: false })}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>

        <div className="well grid gap-1.5 px-4 py-3 font-mono text-[12.5px] leading-[1.55]">
          <p>
            <span className="text-muted">redeem </span>
            {formatNumber(safeRedeemM)}M × floor = <strong className="font-semibold">{formatSol(r.payoutSol, { compact: false })}</strong> paid out,{" "}
            <span className="text-rust">{formatNumber(safeRedeemM)}M burned</span>
          </p>
          <p>
            <span className="text-muted">floor </span>({formatNumber(reserve, 1)} − {formatNumber(r.payoutSol, 2)}) ÷ {formatNumber(r.after.circulating / M, 1)}M ={" "}
            <strong className="font-semibold">the same floor</strong>
          </p>
          <p>
            <span className="text-muted">fee </span>+{formatNumber(fee, 1)} SOL, same supply → floor{" "}
            <strong className="font-semibold text-accent">{fee > 0 ? `up ${formatPct(rise, 2)}` : "unchanged"}</strong>
          </p>
        </div>
        <Note>
          Both sides shrink in proportion when you redeem, so the floor holds. Payouts round down to the lamport, so any dust stays in the
          vault. A fee adds SOL without adding tokens, so the floor can only go up.
        </Note>
      </div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="max-w-[44rem] text-sm leading-[1.5] text-pretty text-muted">{children}</p>;
}

function RangeField({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="field-aside">{unit}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
        <input
          type="range"
          className="range"
          aria-label={`${label}, ${unit}`}
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="input min-h-9 px-2">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            className="h-[34px]! text-right font-mono text-sm tabular-nums"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChange(clamp(v));
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Three-state strip: the floor drawn as steps across Before / Redeem / Fee. */
function StepStrip({ floors }: { floors: number[] }) {
  const W = 600;
  const H = 84;
  // Scaled to the data range (not from zero) so a small rise still reads as a step.
  const hi = Math.max(...floors);
  const lo = Math.min(...floors);
  const span = Math.max(hi - lo, hi * 0.04) || 1;
  const y = (v: number) => H - 14 - (0.25 + (0.6 * (v - lo)) / span) * (H - 24);
  const seg = W / 3;
  const d = floors.map((f, i) => `${i ? "V" : "M0 "}${y(f).toFixed(1)} H${((i + 1) * seg).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="The floor across the three steps: level after the redemption, higher after the fee.">
      <defs>
        <pattern id="calc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V6" stroke="var(--accent)" strokeWidth="1.5" opacity=".35" />
        </pattern>
      </defs>
      <path d={`${d} V${H - 14} H0 Z`} fill="url(#calc-hatch)" />
      {[1, 2].map((i) => (
        <path key={i} d={`M${i * seg} 4V${H - 14}`} stroke="var(--rule-strong)" strokeDasharray="3 3" />
      ))}
      <path d={`M0 ${H - 14}H${W}`} stroke="var(--text)" strokeWidth="1.5" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="3.5" />
      {floors.map((_, i) => (
        <text key={i} x={i * seg + 8} y={H - 2} fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)">
          {i + 1}
        </text>
      ))}
    </svg>
  );
}
