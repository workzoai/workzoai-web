import type { Metadata } from "next";
import "./globals.css";
import LegacyStoragePrivacyCleanup from "@/components/privacy/LegacyStoragePrivacyCleanup";
import CookieConsentBanner from "@/components/privacy/CookieConsentBanner";
import WorkZoFounderAnalyticsTracker from "@/components/WorkZoFounderAnalyticsTracker";
import { AppLanguageProvider } from "@/lib/workzoAppLanguage";
import WorkOBotRouteGate from "@/components/WorkOBotRouteGate";
import { ThemeProvider } from "@/lib/workzoTheme";


export const metadata: Metadata = {
  metadataBase: new URL("https://workzoai.com"),
  title: {
    default: "WorkZo AI",
    template: "%s | WorkZo AI",
  },
  description:
    "Practice realistic AI recruiter interviews based on your CV, target role, and job description.",
  icons: {
    icon: [{ url: "/favicon.ico?v=2" }],
    shortcut: "/favicon.ico?v=2",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "WorkZo AI",
    description:
      "Practice realistic AI recruiter interviews based on your CV, target role, and job description.",
    url: "https://workzoai.com",
    siteName: "WorkZo AI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WorkZo AI",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkZo AI",
    description:
      "Practice realistic AI recruiter interviews based on your CV, target role, and job description.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <LegacyStoragePrivacyCleanup />
          <WorkZoFounderAnalyticsTracker />
          {children}
          <WorkOBotRouteGate />
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
