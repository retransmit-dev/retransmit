import Link from "next/link";

import { CtaButton } from "@/components/marketing/cta-button";
import { publishedPages } from "@/lib/pages";
import { absoluteUrl, siteConfig } from "@/lib/site";

/* Rendered with a real 404 status for any unmatched path. Agents fetching
   with `Accept: text/markdown` get the Markdown equivalent from the proxy
   instead; this page carries the same recovery links for everyone else. */

const MACHINE_LINKS = [
  { href: "/sitemap.xml", label: "sitemap.xml" },
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/openapi.json", label: "openapi.json" },
] as const;

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-3 text-4xl text-balance md:text-5xl">
        This page does not exist.
      </h1>
      <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
        The address may be mistyped, or the page may have moved. Here is
        where to look next.
      </p>

      <ul className="mt-10 flex flex-col gap-3 text-base leading-relaxed">
        <li>
          <Link href="/" className="font-medium text-primary hover:underline">
            Home
          </Link>
          <span className="text-muted-foreground">
            {" "}
            : product overview and pricing model
          </span>
        </li>
        {publishedPages().map((page) => (
          <li key={page.href}>
            <Link
              href={page.href}
              className="font-medium text-primary hover:underline"
            >
              {page.title}
            </Link>
          </li>
        ))}
        <li>
          <a
            href={siteConfig.links.docs}
            className="font-medium text-primary hover:underline"
          >
            Documentation
          </a>
          <span className="text-muted-foreground">
            {" "}
            : quickstart, API reference, and webhooks
          </span>
        </li>
      </ul>

      <p className="mt-10 text-sm text-muted-foreground">
        Machine-readable:{" "}
        {MACHINE_LINKS.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? ", " : ""}
            <a
              href={absoluteUrl(link.href)}
              className="font-mono underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              {link.label}
            </a>
          </span>
        ))}
        . Every page also serves Markdown via{" "}
        <code className="font-mono">Accept: text/markdown</code>.
      </p>

      <div className="mt-10">
        <CtaButton href="/">Back to home</CtaButton>
      </div>
    </div>
  );
}
