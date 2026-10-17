import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { getDataSource } from "@/lib/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/projects", "/launch", "/redeem", "/docs", "/explorer"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/projects" ? ("hourly" as const) : ("weekly" as const),
    priority: path === "" ? 1 : 0.7,
  }));
  const { tokens } = await getDataSource().listTokens();
  return [
    ...pages,
    ...tokens.map((t) => ({ url: `${SITE_URL}/token/${t.mint}`, changeFrequency: "hourly" as const, priority: 0.5 })),
  ];
}
