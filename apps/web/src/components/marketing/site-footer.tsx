import { siteConfig } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
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
      { label: "npm — retransmit.dev", href: siteConfig.links.npm },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-xs">
            <p className="font-heading text-lg font-extrabold tracking-tight">
              retransmit<span className="text-primary">.</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              One API. One balance. Every message. Starting with email.
            </p>
          </div>
          <div className="flex gap-16">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-medium">{column.title}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-12 text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} Retransmit. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
