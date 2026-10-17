import type { MetadataRoute } from "next";
import { PREVIEW, SITE_URL } from "@/lib/config";

// Keep the preview out of search engines; open it up once programs and data are live.
export default function robots(): MetadataRoute.Robots {
  if (PREVIEW) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
