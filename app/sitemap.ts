import type { MetadataRoute } from "next";

/**
 * app/sitemap.ts, public, indexable routes only. App/auth/internal routes
 * (dashboard, interview, dev-tools, admin, account, results...) are
 * deliberately excluded; robots.ts disallows them as well.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://workzoai.com";
  const now = new Date();

  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/enterprise", priority: 0.9, changeFrequency: "monthly" },
    { path: "/for-education", priority: 0.9, changeFrequency: "monthly" },
    { path: "/demo", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/resources", priority: 0.6, changeFrequency: "weekly" },
    { path: "/security", priority: 0.6, changeFrequency: "monthly" },
    { path: "/changelog", priority: 0.5, changeFrequency: "weekly" },
    { path: "/roadmap", priority: 0.5, changeFrequency: "monthly" },
    { path: "/help", priority: 0.5, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/status", priority: 0.3, changeFrequency: "daily" },
    { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/impressum", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/cookies", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/disclaimer", priority: 0.2, changeFrequency: "yearly" },
    { path: "/legal/responsible-ai", priority: 0.4, changeFrequency: "yearly" },
    { path: "/legal/accessibility", priority: 0.4, changeFrequency: "yearly" },
    { path: "/for-education/universities-career-services", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-education/coding-bootcamps", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-education/training-academies", priority: 0.7, changeFrequency: "monthly" },
    { path: "/for-education/enterprise-hiring", priority: 0.7, changeFrequency: "monthly" },
    { path: "/for-education/recruitment-agencies", priority: 0.7, changeFrequency: "monthly" },
    { path: "/legal/delete-data", priority: 0.2, changeFrequency: "yearly" },
  ];

  return routes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
