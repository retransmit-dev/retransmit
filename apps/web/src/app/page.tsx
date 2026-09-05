import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { CtaButton } from "@/components/marketing/cta-button";
import { MessageDemo } from "@/components/marketing/message-demo";
import { ProductIcon } from "@/components/marketing/product-icon";
import { PRODUCTS, productHref } from "@/lib/products";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/", types: { "text/markdown": "/index.md" } },
};

const FEATURES = [
  {
    title: "Queued delivery",
    body: "Messages are queued and retried automatically when a provider fails.",
  },
  {
    title: "Signed webhooks",
    body: "Delivery updates arrive at your endpoint with an HMAC signature.",
  },
  {
    title: "Message history",
    body: "Look up any message by ID. See its status and the events behind it.",
  },
];

export default function Home() {
  return (
    <div className="home-editorial">
      <section className="editorial-hero">
        <div className="hero-copy">
          <p className="editorial-label">Messaging infrastructure</p>
          <h1>
            Email, SMS
            <br />
            &amp; WhatsApp.
            <br />
            <span>One API.</span>
          </h1>
          <p className="hero-description">
            Send messages from your app with one API key and one Node.js SDK.
          </p>
          <div className="hero-actions">
            <CtaButton
              href={siteConfig.links.app}
              goal="start_signup"
              goalPlacement="home_hero"
            >
              Get your API key
              <ArrowRight className="size-4" aria-hidden />
            </CtaButton>
            <a
              href={siteConfig.links.quickstart}
              className="editorial-link"
              data-wa-goal="start_quickstart"
              data-wa-goal-placement="home_hero"
            >
              Quickstart
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
          <a href={siteConfig.links.github} className="hero-source">
            Open source / AGPL-3.0
            <ArrowUpRight className="size-3" aria-hidden />
          </a>
        </div>
        <div className="hero-example">
          <MessageDemo />
        </div>
      </section>

      <section id="channels" className="editorial-section">
        <div className="editorial-section-heading">
          <p className="editorial-label">01 / Channels</p>
          <h2>
            One integration.
            <br />
            Three ways to send.
          </h2>
        </div>
        <div className="channel-list">
          {PRODUCTS.map((product) => (
            <Link
              key={product.slug}
              href={productHref(product)}
              className="channel-row"
            >
              <ProductIcon
                slug={product.slug}
                className="channel-row-icon"
                aria-hidden
              />
              <h3>{product.name}</h3>
              <p>{product.summary}</p>
              {product.status === "coming-soon" ? (
                <span className="channel-soon">Coming soon</span>
              ) : (
                <ArrowUpRight className="channel-row-arrow" aria-hidden />
              )}
            </Link>
          ))}
        </div>
      </section>

      <section id="features" className="editorial-section">
        <div className="editorial-section-heading">
          <p className="editorial-label">02 / Infrastructure</p>
          <h2>
            After the API call,
            <br />
            we handle delivery.
          </h2>
          <a href={siteConfig.links.apiReference} className="editorial-link">
            API reference
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
        <div className="infrastructure-list">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="editorial-section">
        <div className="editorial-section-heading">
          <p className="editorial-label">03 / Deployment</p>
          <h2>
            Hosted by us.
            <br />
            Or run by you.
          </h2>
        </div>
        <div className="deployment-list">
          <div>
            <div className="deployment-title">
              <h3>Retransmit Cloud</h3>
              <span>Pay per send</span>
            </div>
            <p>
              Prepaid credits. No subscription or seat fees. Top up by bank
              transfer or mobile money.
            </p>
            <a
              href={siteConfig.links.app}
              className="editorial-link"
              data-wa-goal="start_signup"
              data-wa-goal-placement="home_pricing"
            >
              Create an account
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
          <div>
            <div className="deployment-title">
              <h3>Self-hosted</h3>
              <span>Free software</span>
            </div>
            <p>
              Run the API and dashboard on your servers. Bring your own provider
              credentials.
            </p>
            <a href={siteConfig.links.github} className="editorial-link">
              Get the source
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="editorial-end">
        <div>
          <p className="editorial-label">Get started</p>
          <h2>Send your first message.</h2>
        </div>
        <CtaButton
          href={siteConfig.links.app}
          goal="start_signup"
          goalPlacement="home_final"
        >
          Get your API key
          <ArrowRight className="size-4" aria-hidden />
        </CtaButton>
      </section>
    </div>
  );
}
