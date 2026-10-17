"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav";

/** Bottom navigation under 60rem, where the header nav is hidden. */
export function Dock() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-strong bg-bg pb-[env(safe-area-inset-bottom)] min-[60rem]:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-6 px-1">
        {[...PRIMARY_NAV, ...SECONDARY_NAV].map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] leading-none font-semibold no-underline",
                  active ? "text-ink" : "text-muted",
                  active && "before:absolute before:top-0 before:inset-x-3 before:h-0.5 before:bg-accent before:content-['']",
                )}
              >
                <Icon className={active ? "text-accent" : undefined} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
