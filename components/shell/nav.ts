import { IconDocs, IconExplorer, IconLaunch, IconPortfolio, IconProjects, IconRedeem } from "@/components/icons";

export const PRIMARY_NAV = [
  { href: "/projects", label: "Projects", Icon: IconProjects },
  { href: "/launch", label: "Launch", Icon: IconLaunch },
  { href: "/redeem", label: "Redeem", Icon: IconRedeem },
] as const;

export const SECONDARY_NAV = [
  { href: "/explorer", label: "Explorer", Icon: IconExplorer },
  { href: "/docs", label: "Docs", Icon: IconDocs },
  { href: "/portfolio", label: "Portfolio", Icon: IconPortfolio },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/token/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
