/**
 * Fig. 2 tile pictograms. 72x56, drawn in the plinth language: ink outlines,
 * stone fills, verdigris for anything that ends up in the reserve.
 */
import type { ReactNode } from "react";

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 72 56" width="100%" className="block h-auto max-w-[120px]" role="img" aria-label={label}>
      <path d="M4 50H68" stroke="var(--text)" strokeWidth="1.5" />
      {children}
    </svg>
  );
}

const ink = { stroke: "var(--text)", strokeWidth: 1.75 } as const;
const line = { ...ink, fill: "none" } as const;

function Vault({ x = 40, h = 18 }: { x?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={50 - h} width="24" height={h} fill="var(--surface)" stroke="var(--text)" strokeWidth="1.75" />
      <path d={`M${x} ${50 - h}H${x + 24}`} stroke="var(--accent)" strokeWidth="3" />
    </g>
  );
}

/** A buy splits: part to the vault, the rest to the curve. */
export const ReserveShareArt = () => (
  <Frame label="A buy split in two, with one share going into the reserve">
    <circle cx="14" cy="18" r="8" fill="var(--surface)" {...ink} />
    <path d="M14 26v6h12M14 32v8" {...line} />
    <path d="M26 32h10" stroke="var(--accent)" strokeWidth="1.75" />
    <path d="m33 29 3 3-3 3" stroke="var(--accent)" strokeWidth="1.75" fill="none" />
    <path d="M10 44h8" {...line} />
    <Vault x={40} h={24} />
    <path d="M40 38h24" stroke="var(--rule-strong)" strokeWidth="1" />
    <path d="M40 44h24" stroke="var(--rule-strong)" strokeWidth="1" />
  </Frame>
);

/** A fee drops into the vault and the floor steps up. */
export const FeeToReserveArt = () => (
  <Frame label="A fee dropping into the reserve, raising the floor a step">
    <Vault x={18} h={16} />
    <path d="M10 34H42V26H62" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeDasharray="0" />
    <rect x="46" y="6" width="10" height="10" rx="2" fill="var(--surface)" {...ink} />
    <path d="M51 18v4" {...line} />
    <path d="m48 20 3 3 3-3" {...line} />
    <path d="M42 26v8" stroke="var(--accent)" strokeWidth="2.5" />
  </Frame>
);

/** A small cut to the creator, outside the reserve. */
export const CreatorFeeArt = () => (
  <Frame label="A small fee paid to the creator">
    <circle cx="16" cy="22" r="7" fill="var(--surface)" {...ink} />
    <path d="M24 22h14" {...line} />
    <path d="m35 19 3 3-3 3" {...line} />
    <circle cx="52" cy="18" r="6" fill="var(--surface)" {...ink} />
    <path d="M42 50c0-10 4-16 10-16s10 6 10 16" fill="var(--surface)" {...ink} />
  </Frame>
);

/** First buy unlocks in steps over time. */
export const VestingArt = () => (
  <Frame label="A first buy unlocking in steps over a number of days">
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={i}
        x={8 + i * 12}
        y={42 - i * 6}
        width="10"
        height={8 + i * 6}
        fill={i < 3 ? "var(--surface)" : "var(--well)"}
        stroke="var(--text)"
        strokeWidth="1.5"
        strokeDasharray={i < 3 ? undefined : "2 2"}
      />
    ))}
    <path d="M8 10h56" stroke="var(--rule-strong)" strokeWidth="1" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <path key={i} d={`M${8 + i * 11.2} 7v6`} stroke="var(--text)" strokeWidth="1.5" />
    ))}
  </Frame>
);

/** Redemption opens after a wait, or straight away. */
export const RedemptionDelayArt = () => (
  <Frame label="A clock beside a gate that opens to the reserve">
    <circle cx="20" cy="24" r="12" fill="var(--surface)" {...ink} />
    <path d="M20 16v8l5 4" {...line} />
    <path d="M40 50V20h8v30" fill="var(--surface)" {...ink} />
    <path d="M48 20l12-6v36" {...line} />
    <path d="M52 50V30" stroke="var(--accent)" strokeWidth="2.5" />
  </Frame>
);
