import { linePath, scaler, stepPath, type Pt } from "@/lib/svg";

/** Price line over a stepped floor with the reserve hatched underneath. */
export function PriceFloorSpark({
  price,
  floor,
  height = 56,
  id,
  label,
}: {
  price: number[];
  floor: number[];
  height?: number;
  id: string;
  label: string;
}) {
  const W = 280;
  const H = height;
  const max = Math.max(...price, ...floor) * 1.06 || 1;
  const x = scaler([0, Math.max(1, price.length - 1)], [1, W - 1]);
  const y = scaler([0, max], [H - 1, 3]);
  const p: Pt[] = price.map((v, i) => [x(i), y(v)]);
  const f: Pt[] = floor.map((v, i) => [x(i), y(v)]);
  const floorD = stepPath(f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-auto w-full" role="img" aria-label={label}>
      <defs>
        <pattern id={`h-${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V5" stroke="var(--accent)" strokeWidth="1.25" opacity=".35" />
        </pattern>
      </defs>
      <path d={`${floorD} V${H} H${f[0]?.[0] ?? 0} Z`} fill={`url(#h-${id})`} />
      <path d={floorD} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={linePath(p)} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A horizontal gauge: the floor as a share of the price. */
export function FloorGauge({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
        <span className="text-muted">Floor / price</span>
        <span className="font-semibold text-accent tabular-nums">{pct.toFixed(0)}%</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-[2px] bg-[var(--tint-soft)] ring-1 ring-rule ring-inset"
        role="meter"
        aria-label="Floor as a share of price"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
