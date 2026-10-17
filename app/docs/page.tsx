import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/ui";
import { shortAddress, solscanAccount } from "@/lib/format";
import { bpsToPct, LIMITS } from "@/lib/limits";
import { PROGRAMS_LIVE } from "@/lib/config";
import { PROGRAM_LIST } from "@/lib/programs";

const S = LIMITS.settings;
const range = (r: { min: number; max: number }) => `${bpsToPct(r.min)}–${bpsToPct(r.max)}%`;
const maxDelayH = Math.max(...S.redemptionDelayHours.options);

export const metadata: Metadata = { title: "Docs", description: "How Strata floors, reserves and redemption work." };

const SECTIONS = [
  { id: "floor", title: "Why a floor" },
  { id: "math", title: "The math" },
  { id: "settings", title: "Launch settings" },
  { id: "redemption", title: "Redemption" },
  { id: "wallets", title: "Wallets" },
  { id: "programs", title: "Programs" },
];

export default function DocsPage() {
  return (
    <div className="frame pt-0 lg:pt-8">
      <div className="grid grid-cols-1 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-x-10 xl:grid-cols-[224px_minmax(0,1fr)_224px] xl:gap-x-14">
        <nav aria-label="Docs" className="sticky top-[var(--header-h)] z-20 -mx-[var(--gutter)] mb-5 border-b border-rule-strong bg-bg px-[var(--gutter)] py-3 lg:top-[calc(var(--header-h)+32px)] lg:m-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0">
          <p className="mb-1 hidden justify-between border-b border-rule-strong pb-2.5 font-mono text-xs font-semibold lg:flex">
            <span>Docs</span>
            <span className="font-medium">Protocol</span>
          </p>
          <ul className="flex gap-4 overflow-x-auto lg:grid lg:gap-0 lg:bg-[linear-gradient(var(--rule-strong)_0_0)] lg:bg-[length:1px_100%] lg:bg-[1px_0] lg:bg-no-repeat lg:pt-2">
            {SECTIONS.map((s) => (
              <li key={s.id} className="flex-none">
                <a href={`#${s.id}`} className="block py-1 text-sm whitespace-nowrap no-underline hover:underline hover:decoration-2 hover:underline-offset-4 lg:py-1.5 lg:pl-4">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-[44rem] [&_h2]:mt-14 [&_h2]:mb-4 [&_h2]:scroll-mt-28 [&_p]:mt-3 [&_p]:text-[1.0625rem] [&_p]:leading-[1.65]">
          <Plate>Docs</Plate>
          <h1 className="type-h1 mt-3.5">How a Strata floor works</h1>
          <p className="text-lead! text-muted">
            One page, six parts. If you only read one, read <a href="#math" className="text-accent underline underline-offset-4">the math</a>.
          </p>

          <h2 id="floor" className="type-h2">
            Why a floor
          </h2>
          <p>
            On a plain bonding curve, the SOL that buyers put in is the same SOL that pays sellers on the way out. When everyone heads for
            the door, the last people out get very little, and sometimes nothing.
          </p>
          <p>
            Strata keeps a second pot for every token: a reserve vault. A set share of every buy goes into it before the curve sees the
            SOL, and a trading fee adds to it on every trade. The vault only pays out through redemption, and only at the floor.
          </p>

          <h2 id="math" className="type-h2">
            The math
          </h2>
          <pre className="well mt-4 overflow-x-auto px-4 py-3 font-mono text-sm leading-relaxed">
            {`floor = reserve_SOL / circulating_supply

redeem n tokens:
  payout   = n × reserve / supply (rounded down to the lamport)
  reserve' = reserve − payout
  supply'  = supply − n           (the n tokens are burned)
  floor'   = reserve' / supply' = floor

a fee of f SOL:
  reserve' = reserve + f            (rounded up to the lamport)
  floor'   = (reserve + f) / supply  > floor

a buy that creates t tokens:
  deposit ≥ ceil(t × floor)         (or the buy fails)`}
          </pre>
          <p>
            Redemption shrinks the reserve and the supply in the same proportion, so the floor holds. Fees only ever add SOL. Buys add at
            least the floor value of the tokens they create, or they fail, so they can&rsquo;t dilute it either. Every rounding favours the
            vault: payouts round down and amounts owed to the reserve round up. So the floor moves one way: up, and the program checks it
            after every instruction.
          </p>
          <p>
            <Link href="/#fig3-title" className="text-accent underline underline-offset-4">
              Try it in Fig. 3
            </Link>{" "}
            on the homepage.
          </p>

          <h2 id="settings" className="type-h2">
            Launch settings
          </h2>
          <dl className="rows mt-4">
            <div>
              <dt>Reserve share</dt>
              <dd>{range(S.reserveShareBps)} of each buy, after fees, goes to the vault.</dd>
            </div>
            <div>
              <dt>Fee to reserve</dt>
              <dd>{range(S.feeToReserveBps)} of every buy and sell, in SOL, paid straight into the vault.</dd>
            </div>
            <div>
              <dt>Creator fee</dt>
              <dd>{range(S.creatorFeeBps)} of every buy and sell, in SOL, to the creator. It never comes out of the reserve.</dd>
            </div>
            <div>
              <dt>Vesting</dt>
              <dd>
                The creator&rsquo;s first buy can unlock linearly over {S.vestingDays.min}–{S.vestingDays.max} days.
              </dd>
            </div>
            <div>
              <dt>Redemption</dt>
              <dd>Opens from the first block, or after a delay of up to {maxDelayH} hours.</dd>
            </div>
          </dl>

          <h2 id="redemption" className="type-h2">
            Redemption
          </h2>
          <p>
            Redeem from any token page, or from <Link href="/redeem" className="text-accent underline underline-offset-4">Redeem</Link>. A
            sell also checks the floor: tokens go to the curve while it pays more after fees, and the rest are redeemed in the same
            transaction. No fee is charged on redemption. After any trade, circulating supply must be zero or at least{" "}
            {LIMITS.token.minCirculatingTokens.toLocaleString("en-US")} tokens, so a lamport of rounding dust can never sit behind a
            sliver of supply and spike the floor.
          </p>

          <h2 id="wallets" className="type-h2">
            Wallets
          </h2>
          <p>
            A Solana wallet holds your keys and signs transactions. Strata works with Phantom, Solflare and Backpack, and any other
            wallet that supports the Wallet Standard. Install one, write down its recovery phrase somewhere offline, add a little SOL,
            then press Connect. Strata will never ask for your recovery phrase.
          </p>

          <h2 id="programs" className="type-h2">
            Programs
          </h2>
          {!PROGRAMS_LIVE ? (
            <p>
              The programs aren&rsquo;t deployed yet. Their addresses will be listed here, each linked to Solscan, so you can check
              the code you&rsquo;re trusting.
            </p>
          ) : (
          <ul className="mt-4 grid">
            {PROGRAM_LIST.map((p) => (
              <li key={p.address} className="hairline-top flex items-baseline justify-between gap-4 py-2.5">
                <span className="font-semibold">{p.name}</span>
                <a href={solscanAccount(p.address)} target="_blank" rel="noreferrer" className="font-mono text-sm underline underline-offset-2">
                  {shortAddress(p.address, 6)}
                </a>
              </li>
            ))}
          </ul>
          )}
        </article>

        <aside className="hidden xl:block" aria-label="On this page">
          <div className="sticky top-[calc(var(--header-h)+32px)]">
            <p className="mb-2 font-mono text-xs font-semibold">On this page</p>
            <ul className="grid gap-1.5 text-sm text-muted">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="no-underline hover:text-ink">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
