import type { Metadata } from "next";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "Retransmit Docs",
    template: "%s | Retransmit",
  },
  description:
    "One API for Email, SMS, WhatsApp, and OTP. Integrate Retransmit into your apps.",
};

const navbar = (
  <Navbar
    logo={<b>Retransmit</b>}
    projectLink="https://github.com/retransmit-dev/retransmit"
  />
);

const footer = <Footer>{new Date().getFullYear()} © Retransmit.</Footer>;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <Script
          defer
          src="https://analytics.slane.io/tracker.js"
          data-site="mpr2h6sggcey"
          data-persistent="true"
        />
      </Head>
      <body>
        <Layout navbar={navbar} pageMap={await getPageMap()} footer={footer}>
          {children}
        </Layout>
      </body>
    </html>
  );
}
