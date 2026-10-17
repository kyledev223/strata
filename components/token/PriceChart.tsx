"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui";
import type { PricePoint } from "@/lib/data/types";
import { formatNumber } from "@/lib/format";
import { linePath, scaler, stepPath, type Pt } from "@/lib/svg";

const RANGES = [
  { key: "all", label: "All", ms: Infinity },
  { key: "7d", label: "7d", ms: 7 * 86_400_000 },
  { key: "24h", label: "24h", ms: 86_400_000 },
] as const;

const PER = 1_000_000; // chart values are SOL per 1M tokens

function fmt(v: number) {
  return v >= 1 ? formatNumber(v, 3) : formatNumber(v, 4);
}

export function PriceChart({ history, asOf }: { history: PricePoint[]; asOf: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [hover, setHover] = useState<number | null>(null);
  const patId = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const ms = RANGES.find((r) => r.key === range)!.ms;
    const pts = history.filter((h) => asOf - h.t <= ms);
    return pts.length >= 2 ? pts : history.slice(-2);
  }, [history, range, asOf]);

  const H = w < 480 ? 220 : 280;
  const pad = { l: 8, r: 64, t: 14, b: 26 };
  const max = Math.max(...data.map((d) => d.price)) * PER * 1.08;
  const min = Math.min(...data.map((d) => d.floor)) * PER * 0.85;
  const x = scaler([data[0].t, data[data.length - 1].t], [pad.l, w - pad.r]);
  const y = scaler([min, max], [H - pad.b, pad.t]);
  const price: Pt[] = data.map((d) => [x(d.t), y(d.price * PER)]);
  const floor: Pt[] = data.map((d) => [x(d.t), y(d.floor * PER)]);
  const floorD = stepPath(floor);
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * (i + 0.5)) / 4);
  const last = data[data.length - 1];
  // Last-value tags: keep the price tag clear of the floor tag when they're close.
  const tagF = y(last.floor * PER);
  const tagP = Math.min(y(last.price * PER), tagF - 20);
  const sel = hover != null ? data[Math.min(hover, data.length - 1)] : null;
  const selX = sel ? x(sel.t) : 0;

  const pick = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].t) - px) < Math.abs(x(data[best].t) - px)) best = i;
    setHover(best);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden="true">
              <path d="M0 4h16" stroke="var(--text)" strokeWidth="2" />
            </svg>
            price
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden="true">
              <path d="M0 4h16" stroke="var(--accent)" strokeWidth="3" />
            </svg>
            floor
          </span>
          <span className="text-muted">SOL per 1M tokens</span>
        </div>
        <div role="radiogroup" aria-label="Chart range" className="seg">
          {RANGES.map((r) => (
            <button key={r.key} type="button" role="radio" aria-checked={range === r.key} onClick={() => setRange(r.key)} className="h-7! px-2.5!">
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={wrap} className="relative">
        <svg
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          className="block h-auto w-full touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          role="img"
          aria-label={`Price and floor chart. Latest price ${fmt(last.price * PER)} SOL per million tokens, floor ${fmt(last.floor * PER)}. Use left and right arrow keys to inspect points.`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setHover((h) => {
                const cur = h ?? data.length - 1;
                return Math.max(0, Math.min(data.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
              });
            }
            if (e.key === "Escape") setHover(null);
          }}
          onBlur={() => setHover(null)}
        >
          <defs>
            <pattern id={patId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V6" stroke="var(--accent)" strokeWidth="1.5" opacity=".3" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <path d={`M${pad.l} ${y(t)}H${w - pad.r}`} stroke="var(--rule)" />
              <text x={w - pad.r + 8} y={y(t) + 4} fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)">
                {fmt(t)}
              </text>
            </g>
          ))}
          <path d={`${floorD} V${H - pad.b} H${floor[0][0]} Z`} fill={`url(#${patId})`} />
          <path d={floorD} fill="none" stroke="var(--accent)" strokeWidth="3" />
          <path d={linePath(price)} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${pad.l} ${H - pad.b}H${w - pad.r}`} stroke="var(--text)" strokeWidth="1.5" />
          {/* last-value tags */}
          <g>
            <rect x={w - pad.r + 2} y={tagP - 9} width={pad.r - 4} height="18" rx="3" fill="var(--text)" />
            <text x={w - pad.r + 8} y={tagP + 4} fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--bg)">
              {fmt(last.price * PER)}
            </text>
            <rect x={w - pad.r + 2} y={tagF - 9} width={pad.r - 4} height="18" rx="3" fill="var(--accent)" />
            <text x={w - pad.r + 8} y={tagF + 4} fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--on-accent)">
              {fmt(last.floor * PER)}
            </text>
          </g>
          {sel && (
            <g pointerEvents="none">
              <path d={`M${selX} ${pad.t}V${H - pad.b}`} stroke="var(--text)" strokeDasharray="3 3" />
              <circle cx={selX} cy={y(sel.price * PER)} r="4" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
              <circle cx={selX} cy={y(sel.floor * PER)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
            </g>
          )}
          <text x={pad.l} y={H - 6} fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)">
            {new Date(data[0].t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
          </text>
          <text x={w - pad.r} y={H - 6} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)">
            now
          </text>
        </svg>
        {sel && (
          <div
            aria-live="polite"
            className={cx(
              "raised pointer-events-none absolute top-2 grid min-w-40 gap-0.5 px-2.5 py-2 font-mono text-xs",
              selX > w / 2 ? "left-2" : "right-[72px]",
            )}
          >
            <span className="text-muted">
              {new Date(sel.t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
            </span>
            <span>
              price <strong className="font-semibold">{fmt(sel.price * PER)}</strong>
            </span>
            <span className="text-accent">
              floor <strong className="font-semibold">{fmt(sel.floor * PER)}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
