import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowUpRight, IconBurn } from "@/components/icons";
import { CopyButton } from "@/components/token/CopyButton";
import { CreatorPanel } from "@/components/token/CreatorPanel";
import { PriceChart } from "@/components/token/PriceChart";
import { FloorGauge } from "@/components/token/Spark";
import { TokenGlyph } from "@/components/token/TokenGlyph";
import { TradePanel } from "@/components/token/TradePanel";
import { cx, Panel, SolPrice, Stat } from "@/components/ui";
import { explorerUrl } from "@/lib/config";
import { getDataSource } from "@/lib/data";
import { formatAge, formatBps, formatCompact, formatNumber, formatPct, formatSol, shortAddress } from "@/lib/format";

type Props = { params: Promise<{ mint: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mint } = await params;
  const t = await getDataSource().getToken(mint);
  return t ? { title: `${t.name} (${t.ticker})`, description: `${t.name} on Strata: price, floor and reserve.` } : { title: "Token not found" };
}

export default async function TokenPage({ params, searchParams }: Props) {
  const { mint } = await params;
  const { tab } = await searchParams;
  const ds = getDataSource();
  const [token, { asOf }] = await Promise.all([ds.getToken(mint), ds.listTokens()]);
  if (!token) notFound();

  const ratio = token.floorSol / token.priceSol;
  const s = token.settings;
  const initialTab = tab === "sell" || tab === "redeem" ? tab : "buy";

  return (
    <div className="frame pt-6 lg:pt-10">
      <nav aria-label="Breadcrumb" className="mb-5 font-mono text-xs font-medium text-muted">
        <Link href="/projects" className="underline decoration-transparent decoration-2 underline-offset-4 hover:decoration-current">
          Projects
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page" className="text-ink">
          {token.ticker}
        </span>
      </nav>

      <header className="grid gap-6 lg:grid-12 lg:items-end">
        <div className="flex min-w-0 items-center gap-4 lg:col-span-6">
          <TokenGlyph ticker={token.ticker} hue={token.hue} size={88} className="max-sm:size-16!" />
          <div className="grid min-w-0 gap-2">
            <h1 className="type-h1 truncate">{token.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs font-medium">
              <span className="font-semibold">{token.ticker}</span>
              <span className="inline-flex items-center gap-0.5 text-muted">
                <a href={explorerUrl("account", token.mint)} target="_blank" rel="noreferrer" className="underline decoration-transparent underline-offset-2 hover:decoration-current">
                  {shortAddress(token.mint)}
                  <span className="sr-only"> (mint address, opens the explorer)</span>
                </a>
                <CopyButton value={token.mint} label="Copy mint address" />
              </span>
              <span className="text-muted">{formatAge(token.createdAt, asOf)} old</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="status-dot" />
                {token.status === "curve" ? "On the curve" : "Curve complete"}
              </span>
            </p>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-4 lg:col-span-6">
          <Stat size="clamp(17px, 1.6vw + 8px, 26px)" label="Price" value={<SolPrice value={token.priceSol} unit={false} />} />
          <Stat size="clamp(17px, 1.6vw + 8px, 26px)" label="Floor" value={<SolPrice value={token.floorSol} unit={false} />} tone="accent" />
          <Stat
            size="clamp(17px, 1.6vw + 8px, 26px)"
            label="24h"
            value={`${token.change24h >= 0 ? "+" : "−"}${formatPct(Math.abs(token.change24h), 0)}`}
            tone={token.change24h >= 0 ? "accent" : "rust"}
          />
        </div>
      </header>

      {/* DOM order is chart, trade, details so the trade panel follows the chart on mobile. */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Panel title="Price and floor" titleId="chart-title" actions={<FloorGauge ratio={ratio} className="w-44" />} className="lg:col-start-1 lg:row-start-1">
          <PriceChart history={token.history} asOf={asOf} />
        </Panel>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Trade">
          <TradePanel token={token} asOf={asOf} initialTab={initialTab} />
          <CreatorPanel token={token} />
          <div className="well px-4 py-3 text-sm leading-[1.5]">
            <p className="mb-1 font-mono text-xs font-semibold">About</p>
            <p className="text-pretty">{token.description || "No description."}</p>
            <a
              href={explorerUrl("account", token.creator)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-muted underline decoration-transparent underline-offset-2 hover:decoration-current"
            >
              Creator {shortAddress(token.creator)} <IconArrowUpRight size={12} />
            </a>
          </div>
        </aside>

        <div className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-2">

          <Panel title="The reserve" titleId="reserve-title" note="One vault per token, owned by the Strata program. No key can withdraw from it.">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Stat label="SOL in reserve" value={formatSol(token.reserveSol)} tone="accent" />
              <Stat label="Circulating" value={formatCompact(token.circulating)} />
              <Stat label="Floor raises" value={formatNumber(token.floorRaises)} />
              <Stat
                label="Redeemed and burned"
                value={
                  <span className="inline-flex items-center gap-1 text-rust">
                    <IconBurn size={16} />
                    {formatCompact(token.redeemedTokens)}
                  </span>
                }
              />
              <Stat label="Fees to reserve" value={formatSol(token.feesToReserveSol)} />
              <Stat label="Holders" value={formatNumber(token.holders)} />
            </div>
          </Panel>

          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <Panel title="Launch settings" titleId="settings-title" note="Set once at launch. Nobody can change them.">
              <dl className="rows -mt-1">
                <div>
                  <dt>Reserve share</dt>
                  <dd>{formatBps(s.reserveShareBps)} of each buy, before the curve</dd>
                </div>
                <div>
                  <dt>Fee to reserve</dt>
                  <dd>{formatBps(s.feeToReserveBps)} of every buy and sell</dd>
                </div>
                <div>
                  <dt>Creator fee</dt>
                  <dd>{s.creatorFeeBps ? `${formatBps(s.creatorFeeBps)} to the creator` : "None"}</dd>
                </div>
                <div>
                  <dt>Vesting</dt>
                  <dd>{s.vestingDays ? `Creator's first buy unlocks over ${s.vestingDays} days` : "No first-buy vesting"}</dd>
                </div>
                <div>
                  <dt>Redemption</dt>
                  <dd>{s.redemptionDelayHours ? `Opened ${s.redemptionDelayHours}h after launch` : "Open from the first block"}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Recent activity" titleId="activity-title">
              <ul className="-mt-1 grid">
                {token.activity.slice(0, 8).map((a, i) => (
                  <li key={i} className="hairline-top grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2 font-mono text-xs first:bg-none">
                    <span
                      className={cx(
                        "font-semibold",
                        a.kind === "buy" && "text-accent",
                        a.kind === "redeem" && "text-rust",
                      )}
                    >
                      {a.kind}
                    </span>
                    <span className="truncate text-muted">
                      {shortAddress(a.wallet)} · {formatCompact(a.tokens)}
                    </span>
                    <span className="tabular-nums">{formatSol(a.sol)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

      </div>
    </div>
  );
}
