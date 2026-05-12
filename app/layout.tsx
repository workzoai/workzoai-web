import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkZo AI | Real Interview AI",
  description:
    "Practice a real interview before the real one with an AI recruiter that reads your CV, asks follow-ups, applies pressure, and gives honest feedback.",
  icons: {
    icon: "/workzo_icon.png",
    shortcut: "/workzo_icon.png",
    apple: "/workzo_icon.png",
  },
  openGraph: {
    title: "WorkZo AI | Real Interview AI",
    description:
      "Face a real interview before the real one.",
    images: ["/workzo_icon.png"],
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
