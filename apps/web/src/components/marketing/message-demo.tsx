"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  Radio,
} from "lucide-react";
import { SyntaxCode, WindowDots } from "@/components/marketing/syntax-code";
import { ProductIcon } from "@/components/marketing/product-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteConfig } from "@/lib/site";
import { AVAILABLE_PRODUCTS, type Product } from "@/lib/products";

export function MessageExample({ product }: { product: Product }) {
  const example = product.example;
  if (!example) return null;
  const source = [
    `const { data, error } = await retransmit.${example.method}({`,
    ...example.fields.map(
      (field) => `  ${field.name}: ${JSON.stringify(field.value)},`,
    ),
    "});",
  ].join("\n");

  return (
    <div className="message-route">
      <div className="min-w-0">
        <div className="demo-stage-label">
          <span>01 / YOUR APP</span>
          <span>Node.js</span>
        </div>
        <div className="demo-code">
          <div className="code-window-titlebar">
            <WindowDots />
            <span>send-{product.slug}.ts</span>
          </div>
          <SyntaxCode
            code={source}
            label={`${product.name} code example`}
            className="px-5 py-6 text-[11px] leading-7 sm:text-xs"
          />
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 font-mono text-[10px] text-muted-foreground">
            <Check className="size-3 text-primary" aria-hidden />
            202 Accepted<span className="ml-auto">status: queued</span>
          </div>
        </div>
      </div>
      <div className="route-connector" aria-hidden>
        <div className="route-track">
          <span />
        </div>
        <div className="route-hub">
          <Radio className="size-8" />
        </div>
        <span className="route-hub-label">retransmit</span>
        <ArrowDown className="route-mobile-arrow size-5" />
      </div>
      <div className="min-w-0">
        <div className="demo-stage-label">
          <span>02 / YOUR CUSTOMER</span>
          <span>Preview</span>
        </div>
        <div className="message-preview" data-channel={product.slug}>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <ProductIcon slug={product.slug} className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold">{product.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Acme · just now
              </p>
            </div>
            <span
              className="ml-auto size-2 rounded-full bg-primary"
              aria-hidden
            />
          </div>
          <div className="preview-message mt-5 rounded-xl bg-muted/80 p-4">
            <p className="text-sm font-semibold">{example.previewTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {example.previewBody}
            </p>
            {product.slug === "email" ? (
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium">
                Explore your account
                <ArrowRight className="size-3" aria-hidden />
              </div>
            ) : null}
          </div>
          <div className="mt-auto flex items-center justify-between pt-5 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCheck className="size-3.5 text-primary" aria-hidden />
              Delivered
            </span>
            <span>Illustrative preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendExample({ product }: { product: Product }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const example = product.example;
  if (!example) return null;
  const source = [
    'import { Retransmit } from "retransmit.dev";',
    "",
    "const client = new Retransmit(",
    "  process.env.RETRANSMIT_API_KEY",
    ");",
    "",
    "const { data, error } =",
    `  await client.${example.method}({`,
    ...example.fields.map(
      (field) => `    ${field.name}: ${JSON.stringify(field.value)},`,
    ),
    "  });",
  ].join("\n");

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(source);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="send-example">
      <div className="example-toolbar">
        <span>send-{product.slug}.ts</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy code"
          onClick={copyExample}
        >
          {copyState === "copied" ? (
            <Check aria-hidden />
          ) : (
            <Copy aria-hidden />
          )}
        </Button>
      </div>
      <SyntaxCode code={source} label={`${product.name} code example`} />
      <div className="example-result">
        <span>Response</span>
        <code>
          202 <span>Accepted</span>
        </code>
      </div>
      <p className="example-note" role="status">
        {copyState === "copied"
          ? "Code copied."
          : copyState === "failed"
            ? "Couldn't copy. Select the code above to copy it."
            : (example.note ??
              "Example request. Messages are queued for delivery.")}
      </p>
    </div>
  );
}

export function MessageDemo() {
  return (
    <div className="api-example">
      <div className="api-example-heading">
        <span>Send a message</span>
        <span>API / v1</span>
      </div>
      <div className="code-editor-window">
        <Tabs defaultValue={AVAILABLE_PRODUCTS[0]?.slug}>
          <div className="code-window-chrome">
            <WindowDots />
            <TabsList variant="line" aria-label="Message channel">
              {AVAILABLE_PRODUCTS.map((product) => (
                <TabsTrigger key={product.slug} value={product.slug}>
                  {product.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {AVAILABLE_PRODUCTS.map((product) => (
            <TabsContent key={product.slug} value={product.slug}>
              <SendExample product={product} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
      <a href={siteConfig.links.npm} className="example-install">
        <span>npm i retransmit.dev</span>
        <ArrowRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
