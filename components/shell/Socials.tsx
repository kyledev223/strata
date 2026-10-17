import { IconPill, IconX } from "@/components/icons";
import { SOCIALS } from "@/lib/programs";

const ICONS = { x: IconX, pumpfun: IconPill } as const;
const NAMES = { x: "X", pumpfun: "pump.fun" } as const;

/** X and pump.fun buttons. Renders nothing until their links are set in lib/programs.ts. */
export function Socials({ variant }: { variant: "header" | "footer" }) {
  if (!SOCIALS.length) return null;
  return (
    <ul className={variant === "footer" ? "-ml-2 flex items-center gap-2" : "flex items-center gap-2"}>
      {SOCIALS.map(({ key, href, label }) => {
        const Icon = ICONS[key as keyof typeof ICONS];
        return (
          <li key={key}>
            {variant === "header" ? (
              <a href={href} target="_blank" rel="noreferrer" aria-label={`${label} (opens in a new tab)`} className="btn btn-secondary btn-icon has-tip">
                <Icon size={key === "x" ? 16 : 20} />
                <span className="tip" aria-hidden="true">
                  {NAMES[key as keyof typeof NAMES]}
                </span>
              </a>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`${label} (opens in a new tab)`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-[4px] px-2 font-semibold hover:bg-[color-mix(in_srgb,currentColor_14%,transparent)] pointer-coarse:min-h-10"
              >
                <Icon size={key === "x" ? 15 : 18} />
                {NAMES[key as keyof typeof NAMES]}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
