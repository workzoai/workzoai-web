import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://workzoai.com"),
  title: {
    default: "WorkZo AI",
    template: "%s | WorkZo AI",
  },
  description:
    "Practice realistic AI recruiter interviews based on your CV, target role, and job description.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
