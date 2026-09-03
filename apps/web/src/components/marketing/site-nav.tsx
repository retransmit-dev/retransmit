import Link from "next/link";

import { CtaButton } from "@/components/marketing/cta-button";
import { ModeToggle } from "@/components/mode-toggle";
import { siteConfig } from "@/lib/site";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.06 11.06 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .3.2.67.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link
      href="/"
      className="font-heading text-lg font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      retransmit<span className="text-primary">.</span>
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="/#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="/#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a>
          <Link
            href="/compare"
            className="transition-colors hover:text-foreground"
          >
            Compare
          </Link>
          <a
            href={siteConfig.links.docs}
            className="transition-colors hover:text-foreground"
          >
            Docs
          </a>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <GitHubIcon className="size-4" />
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <CtaButton
            href={siteConfig.links.quickstart}
            size="sm"
            goal="start_quickstart"
            goalPlacement="nav"
          >
            Get started
          </CtaButton>
        </div>
      </div>
    </header>
  );
}
