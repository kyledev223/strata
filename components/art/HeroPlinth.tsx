import { smoothPath, type Pt } from "@/lib/svg";

/**
 * Hero illustration: a stepped plinth of stone strata. The floor line runs
 * along the step tops and only climbs; the launch curve rides above it and
 * bounces off it; the reserve vault is a chamber cut into the base; the
 * redemption slot takes tokens in and pays SOL out.
 */

const GROUND = 468;
const COL_W = 92;
const X0 = 70;
// Step-top heights, left to right. Each is a floor level.
const TOPS = [384, 342, 292, 236, 176];
const BAND = 17;

const cols = TOPS.map((top, i) => ({ x: X0 + i * COL_W, top }));
const RIGHT = X0 + TOPS.length * COL_W; // 530

// Floor: along the step tops, extended at both ends, with an arrow at the right.
const floorD = [`M${X0 - 26} ${TOPS[0]}`, ...cols.map((c, i) => `${i ? `V${c.top} ` : ""}H${c.x + COL_W}`), `H${RIGHT + 30}`].join(" ");

// Launch curve: always above the floor at its x, kissing it at three bounces.
const CURVE: Pt[] = [
  [52, 374],
  [96, 330],
  [132, 300],
  [170, 336],
  [208, 286],
  [246, 248],
  [282, 286],
  [318, 236],
  [358, 182],
  [394, 230],
  [440, 150],
  [486, 108],
  [532, 82],
  [572, 64],
];
const curveD = smoothPath(CURVE, 0.55);
const BOUNCES: Pt[] = [
  [170, 336],
  [282, 286],
  [394, 230],
];

// Vault chamber cut into the lowest strata.
const VAULT = { x: X0 + COL_W * 1 + 14, y: GROUND - 62, w: COL_W * 2 + 40, h: 48 };

function Column({ x, top, i }: { x: number; top: number; i: number }) {
  const bands: { y: number; h: number }[] = [];
  for (let y = top; y < GROUND; y += BAND) bands.push({ y, h: Math.min(BAND, GROUND - y) });
  return (
    <g>
      {bands.map((b, j) => (
        <rect
          key={j}
          x={x}
          y={b.y}
          width={COL_W}
          height={b.h}
          fill={j === 0 ? "var(--surface)" : (j + i) % 3 === 0 ? "var(--well)" : (j + i) % 3 === 1 ? "var(--surface)" : "color-mix(in srgb, var(--rule) 55%, var(--surface))"}
        />
      ))}
      {bands.slice(1).map((b, j) => (
        <path key={j} d={`M${x} ${b.y}H${x + COL_W}`} stroke="var(--rule-strong)" strokeWidth="1" />
      ))}
      {/* a few fissures for stone texture */}
      <path
        d={`M${x + 18 + ((i * 23) % 50)} ${top + 30}l6 9-4 7M${x + 60 - ((i * 17) % 30)} ${top + 64}l-5 8 3 6`}
        stroke="var(--rule-strong)"
        strokeWidth="1"
        fill="none"
        opacity=".8"
      />
      <rect x={x} y={top} width={COL_W} height={GROUND - top} fill="none" stroke="var(--text)" strokeWidth="2" />
    </g>
  );
}

function Marker({ n, x, y, to }: { n: number; x: number; y: number; to: Pt }) {
  return (
    <g>
      <path d={`M${x} ${y}L${to[0]} ${to[1]}`} stroke="var(--surface)" strokeWidth="5" />
      <path d={`M${x} ${y}L${to[0]} ${to[1]}`} stroke="var(--text)" strokeWidth="1.5" />
      <circle cx={to[0]} cy={to[1]} r="4" fill="var(--surface)" stroke="var(--text)" strokeWidth="1.5" />
      <circle cx={to[0]} cy={to[1]} r="1.5" fill="var(--text)" />
      <rect x={x - 13} y={y - 13} width="26" height="26" rx="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
      <text x={x} y={y + 4.5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="600" fill="var(--on-accent)">
        {n}
      </text>
    </g>
  );
}

export function HeroPlinth() {
  return (
    <svg
      viewBox="0 0 600 520"
      className="block h-auto w-full"
      role="img"
      aria-labelledby="hero-art-title hero-art-desc"
    >
      <title id="hero-art-title">The Strata plinth</title>
      <desc id="hero-art-desc">
        A stepped plinth of stone layers. A green floor line runs along the top of each step and climbs left to right. A price
        curve rides above it and touches it three times without going below. A chamber in the base holds stacked SOL coins. At the
        lower left, a token goes into a slot and SOL comes back out.
      </desc>

      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V8" stroke="var(--rule-strong)" strokeWidth="1.25" />
        </pattern>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="var(--rule)" strokeWidth="1" />
        </pattern>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="var(--accent)" />
        </marker>
        <marker id="arrow-ink" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="var(--text)" />
        </marker>
      </defs>

      {/* catalogue backdrop */}
      <rect x="0" y="0" width="600" height="520" fill="url(#grid)" opacity=".55" />

      {/* ground and hatching */}
      <rect x="20" y={GROUND} width="560" height="22" fill="url(#hatch)" />
      <path d={`M20 ${GROUND}H580`} stroke="var(--text)" strokeWidth="2" />

      {/* plinth */}
      {cols.map((c, i) => (
        <Column key={i} {...c} i={i} />
      ))}

      {/* reserve vault chamber */}
      <g>
        <rect x={VAULT.x} y={VAULT.y} width={VAULT.w} height={VAULT.h} fill="var(--bg)" stroke="var(--text)" strokeWidth="2" />
        <path d={`M${VAULT.x + 2} ${VAULT.y + 6}H${VAULT.x + VAULT.w - 2}`} stroke="var(--cast)" strokeWidth="6" />
        {[0, 1, 2, 3, 4].map((s) =>
          Array.from({ length: [3, 5, 4, 6, 2][s] }, (_, k) => (
            <g key={`${s}-${k}`}>
              <ellipse
                cx={VAULT.x + 26 + s * 42}
                cy={VAULT.y + VAULT.h - 8 - k * 6}
                rx="15"
                ry="4.5"
                fill="var(--surface)"
                stroke="var(--text)"
                strokeWidth="1.5"
              />
            </g>
          )),
        )}
        <text x={VAULT.x + VAULT.w - 8} y={VAULT.y - 7} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--text)">
          RESERVE · SOL
        </text>
      </g>

      {/* redemption slot: token in, burned; SOL out */}
      <g>
        <rect x={X0 - 3} y={GROUND - 54} width="10" height="26" fill="var(--text)" />
        <path d={`M${X0 + 7} ${GROUND - 41}H${VAULT.x - 2}`} stroke="var(--text)" strokeWidth="1.5" strokeDasharray="3 3" />
        <g className="drop-token" style={{ ["--fall" as string]: "0px" }}>
          <circle cx="36" cy={GROUND - 41} r="11" fill="var(--surface)" stroke="var(--accent-2)" strokeWidth="2" />
          <path d={`M30 ${GROUND - 47}l12 12M42 ${GROUND - 47}l-12 12`} stroke="var(--accent-2)" strokeWidth="2" />
        </g>
        <path d={`M48 ${GROUND - 41}H${X0 - 6}`} stroke="var(--text)" strokeWidth="1.5" markerEnd="url(#arrow-ink)" />
        <ellipse cx="36" cy={GROUND - 12} rx="11" ry="4" fill="var(--surface)" stroke="var(--text)" strokeWidth="1.5" />
        <path d={`M${X0 - 6} ${GROUND - 14}H52`} stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#arrow-accent)" />
      </g>

      {/* floor line */}
      <path d={floorD} fill="none" stroke="var(--surface)" strokeWidth="9" strokeLinejoin="miter" />
      <path
        d={floorD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinejoin="miter"
        className="draw-in"
        style={{ ["--len" as string]: "1100" }}
      />
      <path d={`M${RIGHT + 30} ${TOPS[4]}V${TOPS[4] - 36}`} stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="4 4" markerEnd="url(#arrow-accent)" />
      <text x={RIGHT + 30} y={TOPS[4] + 20} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--accent)">
        FLOOR
      </text>

      {/* launch curve */}
      <path d={curveD} fill="none" stroke="var(--bg)" strokeWidth="7" />
      <path d={curveD} fill="none" stroke="var(--text)" strokeWidth="2.5" />
      {BOUNCES.map(([x, y]) => (
        <path key={x} d={`M${x - 7} ${y + 1}l7 5 7-5`} fill="none" stroke="var(--accent)" strokeWidth="2" />
      ))}
      <text x="574" y="54" textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--text)">
        PRICE
      </text>

      {/* numbered callouts */}
      <Marker n={1} x={452} y={66} to={[460, 128]} />
      <Marker n={2} x={VAULT.x + VAULT.w + 46} y={GROUND - 38} to={[VAULT.x + VAULT.w - 4, GROUND - 38]} />
      <Marker n={3} x={352} y={130} to={[384, TOPS[3]]} />
      <Marker n={4} x={36} y={GROUND - 96} to={[36, GROUND - 56]} />
    </svg>
  );
}
