import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/interview",
          "/onboarding",
          "/results",
          "/replay",
          "/history",
          "/account",
          "/settings",
          "/admin",
          "/dev-tools",
          "/founder",
          "/login",
          "/billing",
          "/sentry-example-page",
        ],
      },
    ],
    sitemap: "https://workzoai.com/sitemap.xml",
  };
}
