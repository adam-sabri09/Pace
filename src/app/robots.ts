import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pace-io.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: [
          "/today",
          "/plan",
          "/subjects",
          "/settings",
          "/coach",
          "/coursework",
          "/analytics",
          "/admin",
          "/onboarding",
          "/study/",
          "/practice/",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
