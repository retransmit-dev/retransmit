import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Radio } from "lucide-react";

import { CtaButton } from "@/components/marketing/cta-button";
import { MessageExample } from "@/components/marketing/message-demo";
import { ProductIcon } from "@/components/marketing/product-icon";
import { Badge } from "@/components/ui/badge";
import { JsonLd, breadcrumbSchema } from "@/components/structured-data";
import {
  AVAILABLE_PRODUCTS,
  PRODUCTS,
  getProduct,
  productHref,
} from "@/lib/products";
import { OG_IMAGE, siteConfig } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PRODUCTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const title = `${product.name} API${product.status === "coming-soon" ? ": coming soon" : " for developers"}`;
  return {
    title,
    description: product.description,
    alternates: {
      canonical: productHref(product),
      types: { "text/markdown": `${productHref(product)}.md` },
    },
    openGraph: {
      title,
      description: product.description,
      url: productHref(product),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.description,
      images: [OG_IMAGE],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();
  const upcoming = product.status === "coming-soon";

  return (
    <>
      <section className="marketing-section pt-10 sm:pt-14">
        <Link
          href="/#channels"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All products
        </Link>
        <div className="mx-auto mt-12 max-w-3xl text-center">
          <div className="inline-flex items-center gap-3">
            <span className="product-icon">
              <ProductIcon slug={product.slug} className="size-6" aria-hidden />
            </span>
            <span className="text-sm font-semibold">{product.name}</span>
            {upcoming ? <Badge variant="secondary">Coming soon</Badge> : null}
          </div>
          <h1 className="mt-7 text-4xl leading-[1.06] text-balance tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            {product.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-[48ch] text-base leading-relaxed text-balance text-muted-foreground sm:text-lg">
            {product.description}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaButton
              href={upcoming ? "/#channels" : siteConfig.links.app}
              goal={upcoming ? undefined : "start_signup"}
              goalPlacement={`product_${product.slug}`}
            >
              {upcoming
                ? "Explore available channels"
                : `Start with ${product.name}`}
              <ArrowRight className="size-4" aria-hidden />
            </CtaButton>
            {!upcoming ? (
              <CtaButton href={siteConfig.links.apiReference} tone="quiet">
                Read the API docs
              </CtaButton>
            ) : null}
          </div>
          {!upcoming ? (
            <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
              {product.useCases.map((useCase) => (
                <li key={useCase} className="flex items-center gap-1.5">
                  <Check className="size-3" aria-hidden />
                  {useCase}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {product.example ? (
          <div className="demo-shell mt-14">
            <MessageExample product={product} />
            {product.example.note ? (
              <p className="px-7 pb-5 text-center text-xs text-muted-foreground">
                {product.example.note}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="telegram-preview mt-14" aria-hidden>
            <span className="telegram-orbit" />
            <span className="telegram-orbit inner" />
            <ProductIcon
              slug={product.slug}
              className="relative size-16 text-primary"
            />
          </div>
        )}
      </section>
      {!upcoming ? (
        <section className="marketing-section">
          <div className="grid gap-8 md:grid-cols-3">
            {product.features.map((feature, index) => (
              <div key={feature.title} className="border-t border-border pt-6">
                <p className="font-mono text-xs text-primary">0{index + 1}</p>
                <h2 className="mt-4 text-xl">{feature.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="marketing-section pb-24">
        <div className="platform-panel">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <Radio className="size-6 text-primary" aria-hidden />
              <h2 className="mt-4 text-2xl tracking-tight sm:text-3xl">
                {upcoming
                  ? "Build with what's here."
                  : "There's more to the conversation."}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Keep the same key. Add another channel.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_PRODUCTS.filter(
                (item) => item.slug !== product.slug,
              ).map((item) => (
                <Link
                  key={item.slug}
                  href={productHref(item)}
                  className="inline-flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <ProductIcon
                    slug={item.slug}
                    className="size-4"
                    aria-hidden
                  />
                  {item.name}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", href: "/" },
          { name: product.name, href: productHref(product) },
        ])}
      />
    </>
  );
}
