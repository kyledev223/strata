import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Four plinths of different heights */
export const IconProjects = (p: P) => (
  <Base {...p}>
    <path d="M2.5 17.5h15" />
    <path d="M4 17.5v-5h3v5M8.5 17.5V8h3v9.5M13 17.5v-7h3v7" />
  </Base>
);

/** Arrow rising off a step */
export const IconLaunch = (p: P) => (
  <Base {...p}>
    <path d="M2.5 17.5h6v-4h6v-4h3" />
    <path d="M10 9.5V2.5M7 5.5l3-3 3 3" />
  </Base>
);

/** Token going down onto the floor line */
export const IconRedeem = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="5" r="2.5" />
    <path d="M10 9v6M7.5 12.5 10 15l2.5-2.5" />
    <path d="M2.5 17.5h15" />
  </Base>
);

export const IconExplorer = (p: P) => (
  <Base {...p}>
    <circle cx="8.5" cy="8.5" r="5" />
    <path d="m12.5 12.5 5 5" />
  </Base>
);

export const IconDocs = (p: P) => (
  <Base {...p}>
    <path d="M4 2.5h9l3 3v12H4z" />
    <path d="M7 8h6M7 11h6M7 14h4" />
  </Base>
);

/** Stacked strata */
export const IconPortfolio = (p: P) => (
  <Base {...p}>
    <path d="M2.5 14.5h15v3h-15zM4 10.5h12v4M5.5 6.5h9v4M7 2.5h6v4" />
  </Base>
);

export const IconSun = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" />
  </Base>
);

export const IconMoon = (p: P) => (
  <Base {...p}>
    <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" />
  </Base>
);

export const IconWallet = (p: P) => (
  <Base {...p}>
    <path d="M2.5 5.5h13v12h-13zM2.5 5.5l10-3v3" />
    <path d="M12 11.5h5.5" />
  </Base>
);

export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="m4.5 4.5 11 11M15.5 4.5l-11 11" />
  </Base>
);

export const IconArrowRight = (p: P) => (
  <Base {...p}>
    <path d="M3 10h13M11.5 5.5 16 10l-4.5 4.5" />
  </Base>
);

export const IconArrowUpRight = (p: P) => (
  <Base {...p}>
    <path d="M5.5 14.5 14.5 5.5M7 5.5h7.5V13" />
  </Base>
);

export const IconCopy = (p: P) => (
  <Base {...p}>
    <path d="M7 7h10v10H7z" />
    <path d="M13 7V3H3v10h4" />
  </Base>
);

export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m4 10.5 4 4 8-9" />
  </Base>
);

export const IconImage = (p: P) => (
  <Base {...p}>
    <path d="M2.5 3.5h15v13h-15z" />
    <path d="m2.5 13.5 4.5-4.5 4 4 2.5-2.5 4 4" />
    <circle cx="13" cy="7" r="1.25" />
  </Base>
);

export const IconSearch = IconExplorer;

export const IconBurn = (p: P) => (
  <Base {...p}>
    <path d="M10 17.5c-3.3 0-5.5-2.2-5.5-5.2 0-3.5 3-4.8 3.5-8.8 2.8 1.6 3.7 4 3.5 6 1-.5 1.8-1.5 2-2.5 1.4 1.4 2 3.2 2 5.1 0 3.2-2.3 5.4-5.5 5.4Z" />
  </Base>
);

/** Brand marks, simplified. */
export const IconGitHub = ({ size = 20, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

export const IconX = ({ size = 20, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
  </svg>
);

/** A capsule split in two, for the pump.fun link. */
export const IconPill = (p: P) => (
  <Base {...p} strokeLinecap="round">
    <path d="M10.6 3.4a4.2 4.2 0 0 1 6 6l-7.2 7.2a4.2 4.2 0 0 1-6-6Z" />
    <path d="M7 7l6 6" />
  </Base>
);

/** The Strata mark: three offset strata with a floor line. */
export function StrataMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect x="1" y="1" width="30" height="30" rx="5" fill="var(--text)" />
      <rect x="6" y="20" width="20" height="5" fill="var(--bg)" />
      <rect x="9" y="14" width="14" height="5" fill="var(--bg)" opacity=".72" />
      <rect x="12" y="8" width="8" height="5" fill="var(--bg)" opacity=".48" />
      <rect x="4" y="25.5" width="24" height="2" fill="var(--accent)" />
    </svg>
  );
}
