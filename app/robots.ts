import type { MetadataRoute } from "next";
import { NOINDEX, SITE_URL } from "@/lib/config";

// Keep previews and test-money (devnet) deployments out of search engines.
export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
