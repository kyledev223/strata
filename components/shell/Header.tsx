"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StrataMark } from "@/components/icons";
import { cx } from "@/components/ui";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Socials } from "./Socials";
import { ThemeToggle } from "./ThemeToggle";
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav";

export function Header() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 bg-bg shadow-[inset_0_-1px_0_var(--rule-strong)]">
      <div className="frame flex h-[var(--header-h)] items-center gap-4">
        <Link href="/" aria-label="Strata, home" className="flex flex-none items-center gap-2.5 rounded-[4px] no-underline">
          <StrataMark size={30} />
          <span className="font-display text-[26px] leading-none font-extrabold tracking-[-0.02em] [font-stretch:76%] max-[22.4rem]:hidden">
            Strata
          </span>
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-auto items-center justify-between gap-4 min-[60rem]:flex">
          <ul className="ml-6 flex items-center gap-6">
            {PRIMARY_NAV.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group relative inline-flex h-10 items-center gap-2 px-0.5 text-[15px] leading-none font-semibold whitespace-nowrap no-underline",
                      "after:absolute after:inset-x-0 after:h-0.5 after:bg-accent after:opacity-0 after:transition-opacity after:content-['']",
                      "after:bottom-[calc((40px-var(--header-h))/2)]",
                      active ? "after:opacity-100" : "hover:after:opacity-45",
                    )}
                  >
                    <Icon className="text-accent" />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
          <Socials variant="header" />
          <ul className="flex items-center gap-2">
            {SECONDARY_NAV.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={cx("btn btn-secondary btn-icon has-tip", active && "border-ink")}
                  >
                    <Icon />
                    <span className="tip" aria-hidden="true">
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>
        </nav>

        <div className="ml-auto flex flex-none items-center gap-2 min-[60rem]:ml-2">
          <ConnectButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
