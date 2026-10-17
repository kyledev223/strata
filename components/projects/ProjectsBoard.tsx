"use client";

import { useMemo, useState } from "react";
import { IconClose, IconSearch } from "@/components/icons";
import { TokenCard } from "@/components/token/TokenCard";
import type { LaunchStatus, TokenSort, TokenSummary } from "@/lib/data/types";

const STATUSES: { value: LaunchStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "curve", label: "On the curve" },
  { value: "complete", label: "Curve complete" },
];

const SORTS: { value: TokenSort; label: string }[] = [
  { value: "reserve", label: "Reserve" },
  { value: "volume", label: "Volume 24h" },
  { value: "ratio", label: "Floor / price" },
  { value: "newest", label: "Newest" },
];

const sorters: Record<TokenSort, (a: TokenSummary, b: TokenSummary) => number> = {
  reserve: (a, b) => b.reserveSol - a.reserveSol,
  volume: (a, b) => b.volume24hSol - a.volume24hSol,
  ratio: (a, b) => b.floorSol / b.priceSol - a.floorSol / a.priceSol,
  newest: (a, b) => b.createdAt - a.createdAt,
};

export function ProjectsBoard({ tokens, asOf }: { tokens: TokenSummary[]; asOf: number }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LaunchStatus | "all">("all");
  const [sort, setSort] = useState<TokenSort>("reserve");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tokens
      .filter((t) => status === "all" || t.status === status)
      .filter((t) => !needle || [t.name, t.ticker, t.mint].some((v) => v.toLowerCase().includes(needle)))
      .sort(sorters[sort]);
  }, [tokens, q, status, sort]);

  return (
    <section aria-label="Launches" className="grid gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="input min-h-10 w-full sm:w-80">
          <IconSearch size={16} className="flex-none text-muted" />
          <input
            type="search"
            className="h-[38px]!"
            placeholder="Search by name, ticker or mint"
            aria-label="Search projects by name, ticker or mint"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="btn btn-ghost btn-sm btn-icon -mr-2" aria-label="Clear search" onClick={() => setQ("")}>
              <IconClose size={14} />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Status" className="seg max-w-full overflow-x-auto">
          {STATUSES.map((s) => (
            <button key={s.value} type="button" role="radio" aria-checked={status === s.value} onClick={() => setStatus(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 sm:ml-auto">
          <span className="font-mono text-xs font-medium text-muted">Sort</span>
          <span className="input min-h-10 py-0 pr-1.5">
            <select className="h-[38px]! cursor-pointer pr-1 text-sm font-semibold" value={sort} onChange={(e) => setSort(e.target.value as TokenSort)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <p className="font-mono text-xs font-medium text-muted tabular-nums" aria-live="polite">
        {shown.length} of {tokens.length} launches
      </p>

      {shown.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(288px,100%),1fr))] gap-6">
          {shown.map((t) => (
            <li key={t.mint} className="flex min-w-0">
              <TokenCard token={t} now={asOf} href={`/token/${t.mint}`} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="well grid place-items-center gap-2 px-6 py-16 text-center">
          <p className="type-title">Nothing matches that</p>
          <p className="text-sm text-muted">Try a ticker, or clear the filters.</p>
        </div>
      )}
    </section>
  );
}
