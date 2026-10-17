import { linePath, smoothPath, stepPath, type Pt } from "@/lib/svg";

const W = 360;
const H = 190;
const BASE = 166; // y of zero

function Axes({ zeroLabel = "0" }: { zeroLabel?: string }) {
  return (
    <g>
      {[46, 86, 126].map((y) => (
        <path key={y} d={`M28 ${y}H${W - 8}`} stroke="var(--rule)" strokeWidth="1" />
      ))}
      <path d={`M28 14V${BASE}H${W - 8}`} fill="none" stroke="var(--text)" strokeWidth="1.5" />
      <text x="20" y={BASE + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">
        {zeroLabel}
      </text>
      <text x={W - 8} y={BASE + 16} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">
        time →
      </text>
      <text x="32" y="12" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">
        price
      </text>
    </g>
  );
}

/** A: a plain bonding curve. Up, then all the way back down to zero. */
export function CurveToZero() {
  const up: Pt[] = [
    [30, 156],
    [70, 140],
    [110, 112],
    [140, 70],
    [168, 40],
    [190, 30],
  ];
  const down: Pt[] = [
    [190, 30],
    [214, 52],
    [236, 96],
    [258, 112],
    [280, 140],
    [304, 158],
    [330, 165],
    [350, 166],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[520px]" role="img" aria-label="Price on a plain bonding curve rises, then falls all the way to zero. Nothing sits underneath it.">
      <Axes />
      <path d={`M28 ${BASE}H${W - 8}`} stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={smoothPath(up, 0.6)} fill="none" stroke="var(--text)" strokeWidth="2.5" />
      <path d={smoothPath(down, 0.6)} fill="none" stroke="var(--accent-2)" strokeWidth="2.5" />
      <circle cx="350" cy="166" r="4.5" fill="var(--surface)" stroke="var(--accent-2)" strokeWidth="2" />
      <text x="344" y="150" textAnchor="end" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="600" fill="var(--accent-2)">
        0 SOL
      </text>
    </svg>
  );
}

/** B: a Strata launch. Price can fall, but it lands on a floor that steps up. */
export function CurveOnFloor() {
  const price: Pt[] = [
    [30, 156],
    [62, 136],
    [96, 104],
    [122, 128],
    [148, 92],
    [176, 60],
    [204, 92],
    [234, 108],
    [262, 76],
    [292, 98],
    [322, 62],
    [350, 40],
  ];
  const floor: Pt[] = [
    [30, 160],
    [80, 152],
    [122, 140],
    [168, 128],
    [234, 116],
    [292, 106],
    [350, 98],
  ];
  const floorD = stepPath(floor);
  const fill = `${floorD} V${BASE} H30 Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[520px]" role="img" aria-label="Price on a Strata launch moves up and down but lands on a floor line underneath it. The floor steps up over time and never steps down.">
      <defs>
        <pattern id="reserve-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V6" stroke="var(--accent)" strokeWidth="1.5" opacity=".45" />
        </pattern>
      </defs>
      <Axes />
      <path d={fill} fill="url(#reserve-hatch)" />
      <path d={floorD} fill="none" stroke="var(--accent)" strokeWidth="3" />
      <path d={smoothPath(price, 0.55)} fill="none" stroke="var(--text)" strokeWidth="2.5" />
      {[
        [122, 128],
        [234, 108],
        [292, 98],
      ].map(([x, y]) => (
        <path key={x} d={`M${x - 6} ${y + 3}l6 4 6-4`} fill="none" stroke="var(--accent)" strokeWidth="2" />
      ))}
      <text x="196" y="156" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="600" fill="var(--accent)">
        reserve
      </text>
    </svg>
  );
}

/** Small decorative curve used by tiles. */
export function MiniStep({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} aria-hidden="true">
      <path d={linePath([[2, 20], [20, 20], [20, 14], [40, 14], [40, 8], [62, 8]])} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
    </svg>
  );
}
