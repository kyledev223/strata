import Link from "next/link";
import { cx, SolPrice } from "@/components/ui";
import type { LaunchSettings } from "@/lib/floor";
import { formatAge, formatBps, formatPct, formatSol } from "@/lib/format";
import { FloorGauge, PriceFloorSpark } from "./Spark";
import { TokenGlyph } from "./TokenGlyph";

export interface CardToken {
  mint?: string;
  name: string;
  ticker: string;
  hue: number;
  image?: string | null;
  status: "curve" | "complete" | "draft";
  createdAt?: number;
  priceSol: number;
  floorSol: number;
  reserveSol: number;
  change24h?: number;
  settings: LaunchSettings;
  spark?: number[];
  floorSpark?: number[];
}

const STATUS = { curve: "On the curve", complete: "Curve complete", draft: "Not launched yet" } as const;

export function TokenCard({ token, now, href }: { token: CardToken; now?: number; href?: string }) {
  const ratio = token.priceSol > 0 ? token.floorSol / token.priceSol : 0;
  const chg = token.change24h;
  const s = token.settings;
  return (
    <article className="raised relative flex w-full min-w-0 flex-col gap-3.5 p-3 has-[a.card-link:focus-visible]:outline-2 has-[a.card-link:focus-visible]:outline-offset-2 has-[a.card-link:focus-visible]:outline-accent">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3.5">
        <TokenGlyph ticker={token.ticker} hue={token.hue} image={token.image} size={72} />
        <div className="grid min-w-0 content-between">
          <h3 className="truncate font-display text-[26px] leading-[1.02] font-extrabold tracking-[-0.01em] [font-stretch:78%]">
            {href ? (
              <Link href={href} className="card-link no-underline outline-none after:absolute after:inset-0 after:content-['']">
                {token.name || "Your token"}
              </Link>
            ) : (
              token.name || "Your token"
            )}
          </h3>
          <p className="flex min-w-0 items-center gap-3 font-mono text-xs leading-4 font-medium">
            <span className="truncate">{token.ticker || "TICKER"}</span>
            {token.createdAt && now ? <span className="flex-none text-muted">{formatAge(token.createdAt, now)} old</span> : null}
          </p>
          <p className="flex items-center gap-2 font-mono text-xs leading-4 font-medium">
            <span className={cx("status-dot", token.status === "draft" && "bg-muted!")} />
            {STATUS[token.status]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Fig label="Price" value={<SolPrice value={token.priceSol} unit={false} />} />
        <Fig label="Floor" value={<SolPrice value={token.floorSol} unit={false} />} accent />
        <Fig label="Reserve" value={formatSol(token.reserveSol)} />
      </div>

      {token.spark && token.floorSpark && token.spark.length > 1 ? (
        <div className="well px-2 pt-2 pb-1">
          <PriceFloorSpark
            id={token.mint ?? token.ticker}
            price={token.spark}
            floor={token.floorSpark}
            label={`${token.name} price over its floor. The floor is ${formatPct(ratio, 0)} of the price.`}
          />
        </div>
      ) : null}
      <FloorGauge ratio={ratio} />

      <div className="hairline-top mt-auto flex flex-wrap items-center gap-2 pt-3 font-mono text-xs leading-4 font-medium text-muted">
        <span>Reserve {formatBps(s.reserveShareBps)}</span>
        <span aria-hidden="true">·</span>
        <span>Fee {formatBps(s.feeToReserveBps)}</span>
        <span aria-hidden="true">·</span>
        <span>Creator {formatBps(s.creatorFeeBps)}</span>
        {chg !== undefined && (
          <span className={cx("ml-auto tabular-nums", chg >= 0 ? "text-accent" : "text-rust")}>
            {chg >= 0 ? "+" : "−"}
            {formatPct(Math.abs(chg), 0)} 24h
          </span>
        )}
      </div>
    </article>
  );
}

function Fig({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="grid min-w-0 gap-1">
      <p className="stat-label">{label}</p>
      <p className={cx("truncate font-mono text-[15px] leading-[1.15] font-semibold tabular-nums", accent && "text-accent")}>{value}</p>
    </div>
  );
}
