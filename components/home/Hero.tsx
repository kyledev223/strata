import { HeroPlinth } from "@/components/art/HeroPlinth";
import { IconArrowRight, IconLaunch, IconRedeem } from "@/components/icons";
import { ButtonLink, Callout } from "@/components/ui";

const PARTS = [
  {
    where: "The rising line",
    title: "The launch curve",
    body: "Prices every buy and sell. Before it sees a buy, a set share of the SOL is put aside for the reserve.",
  },
  {
    where: "The chamber",
    title: "The reserve vault",
    body: "Holds the SOL behind one token. Only the redemption program can pay out of it, and only at the floor.",
  },
  {
    where: "The steps",
    title: "The floor line",
    body: "Reserve divided by circulating supply. Every fee lifts it a step, and nothing in the programs lowers it.",
  },
  {
    where: "The slot",
    title: "Redemption",
    body: "Hand tokens back at the floor once redemption opens, from the first block unless the launch set a wait. They're burned, and the vault pays you in SOL.",
  },
];

export function Hero() {
  return (
    <div className="grid gap-y-10 lg:grid-12 lg:items-start">
      <div className="@container min-w-0 lg:col-span-5">
        <p className="inline-flex h-6 items-center gap-2 rounded-[4px] bg-[var(--tint)] pr-2 pl-1.5 font-mono text-[11px] font-semibold">
          <IconLaunch size={14} className="text-accent" />
          <span>A Solana launchpad with a floor</span>
        </p>
        <h1 id="home-title" className="mt-3">
          <span className="type-display block [font-size:min(calc(var(--text-display)*.72),13.5cqi)] leading-[.9]">
            A bonding curve can go to zero.
          </span>
          <span className="type-h2 mt-2.5 block text-[calc(var(--text-h2)*.8)] leading-none text-muted">
            A Strata launch can&rsquo;t fall below its floor.
          </span>
          <span className="type-h2 slab mt-2.5 block w-fit max-w-full px-3.5 pt-1.5 pb-2.5 pl-3 text-[calc(var(--text-h2)*.8)] leading-none">
            And the floor only goes&nbsp;up.
          </span>
        </h1>
        <p className="mt-5 max-w-[34rem] border-t-2 border-ink pt-2 text-[13px] leading-[1.4]">
          <span className="mr-2 font-mono text-[11px] font-semibold">Backed, not promised.</span>
          Every token keeps <strong className="font-bold">its own SOL reserve, held by programs, not by a team</strong>.
        </p>
        <div className="mt-4 grid grid-cols-1 items-center justify-start gap-4 sm:grid-cols-[auto_auto] lg:grid-cols-1 xl:grid-cols-[auto_auto]">
          <ButtonLink href="/launch" variant="primary" size="lg">
            Launch a token
            <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/projects" variant="secondary" size="lg">
            See the projects
            <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/redeem" variant="ink" size="lg" className="w-full sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <IconRedeem size={18} />
            Redeem at the floor
            <IconArrowRight size={18} />
          </ButtonLink>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-7">
        <figure className="@container m-0" aria-labelledby="anatomy-caption">
          <figcaption id="anatomy-caption" className="sr-only">
            The anatomy of a Strata launch, in four parts.
          </figcaption>
          <div className="grid grid-cols-1 gap-7 @min-[520px]:grid-cols-2 @min-[520px]:gap-x-8 @min-[760px]:grid-cols-[minmax(0,1.7fr)_minmax(220px,1fr)] @min-[760px]:gap-x-10">
            <div className="min-w-0 @min-[520px]:col-span-2 @min-[760px]:col-span-1 @min-[760px]:col-start-1 @min-[760px]:row-start-1">
              <HeroPlinth />
            </div>
            <ol className="grid content-start gap-[22px] @min-[520px]:col-span-2 @min-[520px]:grid-cols-2 @min-[760px]:col-span-1 @min-[760px]:col-start-2 @min-[760px]:row-span-2 @min-[760px]:row-start-1 @min-[760px]:grid-cols-1 @min-[760px]:gap-y-6 @min-[760px]:pt-2">
              {PARTS.map((p, i) => (
                <Callout key={p.title} no={i + 1} where={p.where} title={p.title}>
                  {p.body}
                </Callout>
              ))}
            </ol>
            <aside aria-label="The Strata reserve" className="raised max-w-[34rem] px-5 pt-[18px] pb-5 @min-[520px]:col-span-2 @min-[760px]:col-span-1 @min-[760px]:col-start-1 @min-[760px]:row-start-2 @min-[760px]:max-w-none">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule-strong pb-2.5">
                <p className="type-title">The Strata reserve</p>
                <p className="font-mono text-xs font-medium text-muted">one per token</p>
              </div>
              <dl className="mt-3.5 grid gap-2.5">
                <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3">
                  <dt className="pt-0.5 font-mono text-xs font-semibold text-muted">Holds</dt>
                  <dd className="text-[15px] leading-[1.4]">SOL for one token, in a vault no wallet can withdraw from.</dd>
                </div>
                <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3">
                  <dt className="pt-0.5 font-mono text-xs font-semibold text-muted">Called by</dt>
                  <dd className="text-[15px] leading-[1.4]">The launch curve on every buy and fee, and the redemption program on every redeem.</dd>
                </div>
              </dl>
            </aside>
          </div>
        </figure>
      </div>
    </div>
  );
}
