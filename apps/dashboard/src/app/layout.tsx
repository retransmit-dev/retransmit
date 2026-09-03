import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";

import Providers from "@/components/providers";
import "../globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Retransmit",
    template: "%s | Retransmit",
  },
  description:
    "Send email, SMS and WhatsApp from one API. Domains, keys, deliveries and analytics in one place.",
  // Nothing in the product app should ever appear in search results.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
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
      <body className="antialiased">
        <Providers>
          <div className="grid h-svh grid-rows-[auto_1fr]">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
