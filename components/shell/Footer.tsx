import Link from "next/link";
import { IconGitHub, IconX, StrataMark } from "@/components/icons";
import { shortAddress, solscanAccount } from "@/lib/format";
import { LINKS, PROGRAM_LIST } from "@/lib/programs";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule-strong bg-deep text-on-deep max-sm:mt-18 [&_:focus-visible]:outline-on-deep">
      <div className="frame grid gap-8 pt-10 pb-8 md:grid-12 md:pt-12 md:pb-10">
        <div className="md:col-span-12 lg:col-span-5">
          <span className="inline-flex items-center gap-3.5">
            <span className="[--text:var(--on-deep)] [--bg:var(--deep)]">
              <StrataMark size={44} />
            </span>
            <span className="font-display text-[40px] leading-none font-extrabold tracking-[-0.02em] [font-stretch:76%]">Strata</span>
          </span>
          <p className="mt-5 max-w-[30rem] text-[15px] leading-normal opacity-85">
            A Solana launchpad where every token holds its own SOL reserve. Redeem at the floor whenever you like. Fees only add to
            the reserve, so the floor only climbs.
          </p>
        </div>

        <nav aria-label="Footer" className="md:col-span-6 lg:col-span-2 lg:col-start-7">
          <p className="mb-3 font-mono text-xs font-medium tracking-[0.02em] opacity-75">Places</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 lg:grid lg:gap-2">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-[15px] leading-[1.3] font-semibold underline decoration-transparent decoration-2 underline-offset-4 hover:decoration-current"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-6 lg:col-span-3 lg:col-start-10">
          <p className="mb-3 font-mono text-xs font-medium tracking-[0.02em] opacity-75">Programs on mainnet</p>
          <ul className="grid">
            {PROGRAM_LIST.map((p) => (
              <li key={p.address}>
                <a
                  href={solscanAccount(p.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-8 items-baseline py-1.5 no-underline pointer-coarse:min-h-10 pointer-coarse:py-2.5"
                >
                  <span className="flex min-w-0 flex-1 items-baseline text-[15px] leading-[1.3] after:mx-2.5 after:h-px after:min-w-4 after:flex-auto after:self-center after:bg-[linear-gradient(90deg,currentColor_0_1px,transparent_1px_4px)] after:bg-[length:4px_1px] after:opacity-50 after:content-['']">
                    {p.name}
                  </span>
                  <span className="flex-none font-mono text-[13px] tabular-nums underline decoration-transparent decoration-2 underline-offset-[3px] group-hover:decoration-current">
                    {shortAddress(p.address)}
                  </span>
                  <span className="sr-only">
                    {" "}
                    program {p.address}, on Solscan (opens in a new tab)
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[11px] leading-4 opacity-60">Placeholder addresses until the programs deploy.</p>
        </div>
      </div>
      <div className="frame">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color-mix(in_srgb,var(--on-deep)_22%,transparent)] pt-4 pb-6 text-sm">
          <a href={LINKS.github} target="_blank" rel="noreferrer" className="mr-2 inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4">
            <IconGitHub size={18} />
            GitHub
          </a>
          <a
            href={LINKS.x}
            target="_blank"
            rel="noreferrer"
            aria-label="Strata on X"
            className="inline-grid size-8 place-items-center rounded-[4px] hover:bg-[color-mix(in_srgb,currentColor_14%,transparent)]"
          >
            <IconX size={16} />
          </a>
          <p className="ml-auto font-mono text-xs opacity-60">© 2026 Strata. Not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
