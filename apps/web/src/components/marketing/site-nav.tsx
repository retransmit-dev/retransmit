"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BookOpen, Menu, Radio } from "lucide-react";

import { CtaButton } from "@/components/marketing/cta-button";
import { ProductIcon } from "@/components/marketing/product-icon";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PRODUCTS, productHref } from "@/lib/products";
import { siteConfig } from "@/lib/site";

export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="Retransmit home"
      className="flex items-center gap-2.5 rounded-sm font-heading text-xl font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span>
        retransmit<span className="text-primary">.</span>
      </span>
    </Link>
  );
}

export function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuValue, setMenuValue] = useState<string | null>(null);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-5 sm:px-6">
        <Wordmark />
        <NavigationMenu
          aria-label="Main navigation"
          className="hidden md:flex"
          value={menuValue}
          onValueChange={setMenuValue}
        >
          <NavigationMenuList>
            <NavigationMenuItem value="products">
              <NavigationMenuTrigger>Product</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[660px] max-w-[calc(100vw-2rem)] grid-cols-[1fr_210px] gap-3 p-3">
                  <div>
                    <p className="px-3 pt-2 pb-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                      Channels
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {PRODUCTS.map((product) => (
                        <NavigationMenuLink
                          key={product.slug}
                          render={<Link href={productHref(product)} />}
                          active={pathname === productHref(product)}
                          onClick={() => setMenuValue(null)}
                          className="items-start p-3"
                        >
                          <div className="flex flex-col gap-3">
                            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-background">
                              <ProductIcon slug={product.slug} aria-hidden />
                            </span>
                            <span className="flex flex-wrap items-center gap-2 font-semibold">
                              {product.name}
                              {product.status === "coming-soon" ? (
                                <Badge variant="secondary">Soon</Badge>
                              ) : null}
                            </span>
                            <span className="text-xs leading-relaxed text-muted-foreground">
                              {product.summary}
                            </span>
                          </div>
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl bg-muted p-5">
                    <div>
                      <Radio className="size-7 text-primary" aria-hidden />
                      <p className="mt-5 text-xl font-semibold leading-tight tracking-tight">
                        One API key.
                        <br />
                        Every channel.
                      </p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Email, SMS, and WhatsApp with one SDK.
                      </p>
                    </div>
                    <NavigationMenuLink
                      href={siteConfig.links.quickstart}
                      onClick={() => setMenuValue(null)}
                      className="mt-6"
                      data-wa-goal="start_quickstart"
                      data-wa-goal-placement="product_menu"
                    >
                      <BookOpen aria-hidden />
                      Quickstart
                      <ArrowRight aria-hidden />
                    </NavigationMenuLink>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink render={<Link href="/compare" />}>
                Compare
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href={siteConfig.links.docs}>
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <CtaButton
            href={siteConfig.links.app}
            size="sm"
            goal="start_signup"
            goalPlacement="nav"
            className="hidden sm:inline-flex"
          >
            Get your API key
            <ArrowRight className="size-3.5" aria-hidden />
          </CtaButton>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu aria-hidden />
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav
                aria-label="Mobile navigation"
                className="flex flex-col gap-2 px-4 pb-6"
              >
                <p className="py-2 text-xs text-muted-foreground">PRODUCT</p>
                {PRODUCTS.map((product) => (
                  <Link
                    key={product.slug}
                    href={productHref(product)}
                    onClick={() => setMobileOpen(false)}
                    aria-current={
                      pathname === productHref(product) ? "page" : undefined
                    }
                    className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ProductIcon
                      slug={product.slug}
                      className="size-5 text-primary"
                      aria-hidden
                    />
                    <span className="flex-1">{product.name}</span>
                    {product.status === "coming-soon" ? (
                      <Badge variant="secondary">Soon</Badge>
                    ) : (
                      <ArrowRight className="size-4" aria-hidden />
                    )}
                  </Link>
                ))}
                <Link
                  href="/compare"
                  className="rounded-lg p-3 hover:bg-muted"
                  onClick={() => setMobileOpen(false)}
                >
                  Compare
                </Link>
                <a
                  href={siteConfig.links.docs}
                  className="rounded-lg p-3 hover:bg-muted"
                >
                  Documentation
                </a>
                <CtaButton
                  href={siteConfig.links.app}
                  size="sm"
                  goal="start_signup"
                  goalPlacement="mobile_nav"
                  className="mt-4"
                >
                  Get your API key
                  <ArrowRight className="size-4" aria-hidden />
                </CtaButton>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
