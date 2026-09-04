import Link from "next/link";

import { CtaButton } from "@/components/marketing/cta-button";
import { ModeToggle } from "@/components/mode-toggle";
import { siteConfig } from "@/lib/site";

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
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a
            href="/#features"
            className="transition-colors hover:text-foreground"
          >
            Features
          </a>
          {/* <a href="/#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a> */}
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
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <CtaButton
            href={siteConfig.links.app}
            size="sm"
            goal="start_signup"
            goalPlacement="nav"
          >
            Get your API key
          </CtaButton>
        </div>
      </div>
    </header>
  );
}
