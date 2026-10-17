import { LiveBadge, Panel, Stat, StatGrid } from "@/components/ui";
import { getDataSource } from "@/lib/data";
import { formatCompact, formatNumber, formatSol } from "@/lib/format";

/** "On Strata now" + "All time" figures, read through the data-source interface. */
export async function Ledger() {
  const stats = await getDataSource().getProtocolStats();
  const size = "clamp(18px, 2.2vw + 6px, 28px)";
  return (
    <div className="mt-10 grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 min-[68rem]:grid-cols-2">
      <Panel title="On Strata now" titleId="ledger-now" actions={<LiveBadge />}>
        <StatGrid min={140}>
          <Stat size={size} label="Launches" value={formatNumber(stats.now.launches)} />
          <Stat size={size} label="SOL in reserves" value={formatSol(stats.now.reserveSol)} tone="accent" />
          <Stat size={size} label="Volume 24h" value={formatSol(stats.now.volume24hSol)} />
        </StatGrid>
      </Panel>
      <Panel title="All time" titleId="ledger-all">
        <StatGrid min={140}>
          <Stat size={size} label="Floors raised" value={formatNumber(stats.allTime.floorRaises)} hint="steps up, never down" />
          <Stat
            size={size}
            label="Redeemed and burned"
            value={<span className="text-rust">{formatCompact(stats.allTime.redeemedBurnedTokens, 1)}</span>}
            hint={`tokens, for ${formatSol(stats.allTime.redeemedSol)}`}
          />
          <Stat size={size} label="Fees to reserves" value={formatSol(stats.allTime.feesToReserveSol)} hint="never withdrawn" />
        </StatGrid>
      </Panel>
    </div>
  );
}

export function LedgerSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-5 min-[68rem]:grid-cols-2" aria-busy="true" aria-label="Loading figures">
      {[0, 1].map((i) => (
        <div key={i} className="raised h-[150px] animate-pulse" />
      ))}
    </div>
  );
}
