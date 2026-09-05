import Link from "next/link";

import { PRODUCTS, productHref } from "@/lib/products";
import { pagesInGroup } from "@/lib/pages";
import { siteConfig } from "@/lib/site";

const COLUMNS = [
  {
    title: "Developers",
    links: [
      { label: "Dashboard", href: siteConfig.links.app },
      { label: "Documentation", href: siteConfig.links.docs },
      { label: "Quickstart", href: siteConfig.links.quickstart },
      { label: "API reference", href: siteConfig.links.apiReference },
      { label: "Webhooks", href: siteConfig.links.webhooks },
    ],
  },
  {
    title: "Open source",
    links: [
      { label: "GitHub", href: siteConfig.links.github },
      { label: "npm: retransmit.dev", href: siteConfig.links.npm },
    ],
  },
] as const;

/* These columns read the page registry, so adding a registry row adds a
   footer link, a sitemap entry, and metadata at once. */
const COMPARE_PAGES = pagesInGroup("compare");
const LEGAL_PAGES = pagesInGroup("legal");

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col justify-between gap-10">
          <div className="max-w-xs">
            <p className="font-heading text-lg font-extrabold tracking-tight">
              retransmit<span className="text-primary">.</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Email, SMS, and WhatsApp. Every message. One API.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-sm font-medium">Product</p>
              <ul className="mt-3 flex flex-col gap-2">
                {PRODUCTS.map((product) => (
                  <li key={product.slug}>
                    <Link
                      href={productHref(product)}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {product.name}
                      {product.status === "coming-soon" ? " (soon)" : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-medium">{column.title}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(link.href === siteConfig.links.app
                          ? {
                              "data-wa-goal": "start_signup",
                              "data-wa-goal-placement": "footer",
                            }
                          : {})}
                        {...(link.href === siteConfig.links.quickstart
                          ? {
                              "data-wa-goal": "start_quickstart",
                              "data-wa-goal-placement": "footer",
                            }
                          : {})}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <p className="text-sm font-medium">Compare</p>
              <ul className="mt-3 flex flex-col gap-2">
                {COMPARE_PAGES.map((page) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Legal</p>
              <ul className="mt-3 flex flex-col gap-2">
                {LEGAL_PAGES.map((page) => (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="mt-12 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Retransmit. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
