import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { FavoritesProvider } from "@/components/favorites-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "LiveEarth — The best view on Earth, right now",
    template: "%s · LiveEarth",
  },
  description:
    "An AI-directed ranking of the most remarkable authorised live scenes on Earth.",
  applicationName: "LiveEarth",
  openGraph: {
    title: "LiveEarth",
    description: "The best view on Earth, right now.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#101617",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <FavoritesProvider>{children}</FavoritesProvider>
      </body>
    </html>
  );
}
