import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";

import "../globals.css";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import Providers from "@/components/providers";
import { SiteStructuredData } from "@/components/structured-data";
import { siteConfig } from "@/lib/site";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}, ${siteConfig.tagline.toLowerCase()}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "email API",
    "transactional email",
    "SMS API",
    "transactional SMS",
    "messaging API",
    "WhatsApp API",
    "open source email API",
    "self-hosted email",
    "batch email API",
    "email webhooks",
    "Retransmit",
  ],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name}, ${siteConfig.tagline.toLowerCase()}`,
    description: siteConfig.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name}, ${siteConfig.tagline.toLowerCase()}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#2b2b2b" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables live on <html> because the base layer sets
    // font-family there; scoping them to <body> leaves that rule invalid.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script
          defer
          src="https://analytics.slane.io/tracker.js"
          data-site="j1eghz0ma3ds"
          data-persistent="true"
        />
      </head>
      <body className="antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
          >
            Skip to content
          </a>
          <SiteNav />
          <main id="main">{children}</main>
          <SiteFooter />
          <SiteStructuredData />
        </Providers>
      </body>
    </html>
  );
}
