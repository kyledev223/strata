/**
 * Strata design system: the catalogue primitives every page is built from.
 * Plate · SectionHead · Figure · Panel · Stat · Callout · Lanes/Lane · Rows · SolPrice
 */
import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { tinyParts } from "@/lib/format";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Plate */

export function Plate({ children, size = "md", className }: { children: ReactNode; size?: "sm" | "md"; className?: string }) {
  return <span className={cx("plate", size === "sm" && "plate-sm", className)}>{children}</span>;
}

/* ----------------------------------------------------------- SectionHead */

export function SectionHead({
  plate,
  title,
  id,
  lede,
}: {
  plate: string;
  title: ReactNode;
  id: string;
  lede?: ReactNode;
}) {
  return (
    <header className="mb-9 grid gap-4 lg:grid-12 lg:items-end">
      <div className="min-w-0 lg:col-span-7">
        <Plate className="mb-3.5">{plate}</Plate>
        <h2 id={id} className="type-h1">
          {title}
        </h2>
      </div>
      {lede && <p className="max-w-[34rem] text-lead text-muted lg:col-span-5 lg:col-start-8 lg:pb-1.5">{lede}</p>}
    </header>
  );
}

/* ---------------------------------------------------------------- Figure */

/** A titled figure inside a sheet: "Fig. 2 · What a launch can set" */
export function FigureName({ plate, children, id }: { plate: string; children: ReactNode; id?: string }) {
  return (
    <p
      id={id}
      className="mb-[18px] flex items-center gap-2.5 border-b-2 border-ink pb-3 font-display text-[1.375rem] leading-[1.1] font-extrabold [font-stretch:84%]"
    >
      <Plate size="sm">{plate}</Plate>
      <span>{children}</span>
    </p>
  );
}

export function Sheet({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("sheet", className)} {...rest}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Panel */

export function Panel({
  title,
  titleId,
  actions,
  note,
  children,
  className,
  as: Tag = "section",
  pad = "md",
}: {
  title?: ReactNode;
  titleId?: string;
  actions?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "aside" | "article";
  pad?: "sm" | "md" | "lg";
}) {
  const padCls = { sm: "p-3", md: "p-4 sm:p-5", lg: "p-5 sm:p-7" }[pad];
  return (
    <Tag className={cx("raised min-w-0", padCls, className)} aria-labelledby={title ? titleId : undefined}>
      {title && (
        <div className="hairline-bottom mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="type-title">
              {title}
            </h2>
            {note && <p className="mt-1 text-sm text-muted">{note}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function LiveBadge({ children = "Live" }: { children?: ReactNode }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 font-mono text-xs font-medium whitespace-nowrap">
      <span className="status-dot" data-live="" />
      <span>{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Stat */

export function Stat({
  label,
  value,
  size = 20,
  hint,
  align = "start",
  className,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  size?: number | string;
  hint?: ReactNode;
  align?: "start" | "end";
  className?: string;
  tone?: "accent" | "rust";
}) {
  return (
    <div
      className={cx("grid min-w-0 content-start gap-1.5", align === "end" && "justify-items-end text-right", className)}
      style={{ "--stat-size": typeof size === "number" ? `${size}px` : size } as CSSProperties}
    >
      <p className="stat-label">{label}</p>
      <p className={cx("stat-value", tone === "accent" && "text-accent", tone === "rust" && "text-rust")}>{value}</p>
      {hint && <p className="text-[13px] leading-[1.4] text-muted">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children, className, min = 132 }: { children: ReactNode; className?: string; min?: number }) {
  return (
    <div
      className={cx("grid min-w-0 items-start gap-x-6 gap-y-5", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Callout */

/** A numbered part in an anatomy figure. */
export function Callout({ no, where, title, children }: { no: number | string; where: string; title: string; children: ReactNode }) {
  return (
    <li className="relative min-w-0">
      <p className="flex items-center gap-2.5">
        <span className="badge badge-accent">{no}</span>
        <span className="font-mono text-xs font-medium">{where}</span>
      </p>
      <p className="mt-2.5 font-display text-[1.3125rem] leading-[1.08] font-[750] tracking-[-0.012em] text-balance [font-stretch:84%]">
        {title}
      </p>
      <p className="mt-1.5 text-[15px] leading-[1.45] text-pretty">{children}</p>
    </li>
  );
}

/* ----------------------------------------------------------------- Lanes */

/** Two comparison lanes whose heads, art, legends and rows line up on a shared subgrid. */
export function Lanes({ children, rows = 3 }: { children: ReactNode; rows?: number }) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[repeat(var(--lane-rows),auto)] lg:gap-x-12 xl:gap-x-16"
      style={{ "--lane-rows": rows + 3 } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function Lane({
  letter,
  name,
  verdict,
  featured,
  art,
  legend,
  rows,
  labelId,
}: {
  letter: string;
  name: string;
  verdict: string;
  featured?: boolean;
  art: ReactNode;
  legend: ReactNode;
  rows: { label: string; text: ReactNode }[];
  labelId: string;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cx(
        "relative grid min-w-0 lg:grid-rows-subgrid",
        featured && "mt-10 lg:mt-0 lg:before:absolute lg:before:top-0 lg:before:bottom-4 lg:before:-left-[25px] lg:before:w-px lg:before:bg-rule-strong xl:before:-left-[33px]",
      )}
      style={{ gridRow: `span ${rows.length + 3}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b-2 border-ink pb-3">
        <p id={labelId} className="flex items-center gap-2.5 font-display text-[1.375rem] leading-[1.1] font-extrabold [font-stretch:84%]">
          <span className={cx("badge", featured ? "badge-accent" : "badge-flat")}>{letter}</span>
          <span>{name}</span>
        </p>
        <p
          className={cx(
            "inline-flex h-6 items-center rounded-[4px] px-2 font-mono text-xs font-semibold whitespace-nowrap",
            featured ? "bg-[var(--accent-soft)] text-accent" : "bg-[var(--tint-soft)]",
          )}
        >
          {verdict}
        </p>
      </div>
      <div className="well mt-4 grid place-items-center overflow-hidden px-2 py-3.5">{art}</div>
      <div className="my-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs leading-4">{legend}</div>
      <dl className="rows grid lg:grid-rows-subgrid" style={{ gridRow: `span ${rows.length}` }}>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LegendItem({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      <span>{children}</span>
    </span>
  );
}

export const Swatch = {
  line: (color: string, dashed = false) => (
    <svg width="16" height="8" aria-hidden="true">
      <path d="M0 4h16" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} />
    </svg>
  ),
  block: (color: string) => <span aria-hidden="true" className="inline-block size-3 rounded-[2px] border-2 border-ink" style={{ background: color }} />,
};

/* -------------------------------------------------------------- SolPrice */

/** Per-token SOL price with subscript-zero notation for tiny values: 0.0₇3121 */
export function SolPrice({ value, unit = true, className }: { value: number; unit?: boolean; className?: string }) {
  const parts = tinyParts(value);
  const full = `${value.toPrecision(4)} SOL`;
  if (!parts) {
    return (
      <span className={className}>
        {value >= 1 ? value.toFixed(2) : value.toPrecision(4)}
        {unit && <span className="text-[0.8em] text-muted"> SOL</span>}
      </span>
    );
  }
  return (
    <span className={className} title={full}>
      <span className="sr-only">{full}</span>
      <span aria-hidden="true">
        {parts.lead}
        <sub className="relative -bottom-[0.1em] align-baseline text-[0.62em] leading-none">{parts.zeros}</sub>
        {parts.digits}
        {unit && <span className="text-[0.8em] text-muted"> SOL</span>}
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- Buttons */

type BtnVariant = "primary" | "secondary" | "ghost" | "ink" | "danger";
type BtnSize = "sm" | "md" | "lg";

export function btn(variant: BtnVariant = "secondary", size: BtnSize = "md", extra?: string) {
  return cx("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, extra);
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: { href: string; variant?: BtnVariant; size?: BtnSize } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={btn(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
