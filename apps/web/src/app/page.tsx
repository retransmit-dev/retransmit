import {
  Check,
  KeyRound,
  MailCheck,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import { Card, CardTray } from "@/components/marketing/card";
import { CodeWindow } from "@/components/marketing/code-window";
import { CtaButton } from "@/components/marketing/cta-button";
import { EventFeed } from "@/components/marketing/event-feed";
import { Highlight, Section, SectionHeading } from "@/components/marketing/section";
import {
  batchNode,
  batchResponse,
  selfHostTerminal,
  sendCurl,
  sendNode,
  sendResponse,
  webhookPayload,
} from "@/components/marketing/snippets";
import { siteConfig } from "@/lib/site";

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Check className="size-3 text-primary" aria-hidden />
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Domain verification",
    body: "Verify your sending domain with SPF and DKIM records the dashboard hands you — exact values, copy-paste ready.",
  },
  {
    icon: MailCheck,
    title: "Bounce & complaint handling",
    body: "Hard bounces and complaints are caught automatically, so your sender reputation is protected without extra code.",
  },
  {
    icon: RefreshCw,
    title: "Queue with retries",
    body: "Every send is queued, rate-limit aware, and retried with exponential backoff. Dead-lettered as failed only when it truly fails.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    body: "Every event is delivered with an HMAC-SHA256 signature and retried up to 8 times with exponential backoff.",
  },
  {
    icon: ScrollText,
    title: "Email logs & status",
    body: "Fetch any email by id and read its full event history — queued, sent, delivered, opened, clicked, bounced.",
  },
  {
    icon: KeyRound,
    title: "API keys",
    body: "Scoped bearer keys you create and revoke from the dashboard. One header and you're authenticated.",
  },
] as const;

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="px-4 pt-14 pb-12 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Open source · Email first, more channels next
          </p>
          <h1 className="mt-6 text-4xl text-balance md:text-6xl">
            The email API you can <Highlight>run anywhere</Highlight>
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-relaxed text-balance text-muted-foreground">
            Transactional email with a typed SDK, batch sending up to 10,000
            emails, and signed webhooks. Use our cloud — or self-host the whole
            stack.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <CtaButton href={siteConfig.links.quickstart}>Get started</CtaButton>
            <CtaButton href={siteConfig.links.github} tone="quiet" external>
              Star on GitHub
            </CtaButton>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Chip>Open source</Chip>
            <Chip>Batch up to 10,000</Chip>
            <Chip>Signed webhooks</Chip>
            <Chip>Typed Node.js SDK</Chip>
          </div>
        </div>
      </section>

      {/* Send */}
      <Section>
        <SectionHeading
          eyebrow="Send"
          title="One request. Email delivered."
          lead="Verify a domain, grab an API key, and send your first email in under five minutes."
        />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <ul className="flex flex-col gap-4 text-base leading-relaxed">
              <CheckItem>
                Typed responses everywhere — every call returns{" "}
                <code className="font-mono text-sm text-foreground">
                  {"{ data, error }"}
                </code>
                , never a thrown surprise.
              </CheckItem>
              <CheckItem>
                Accepted in milliseconds: sends are queued with a{" "}
                <code className="font-mono text-sm text-foreground">202</code>{" "}
                and delivered by a rate-limit-aware worker.
              </CheckItem>
              <CheckItem>
                Zero-dependency SDK on npm as{" "}
                <a
                  href={siteConfig.links.npm}
                  className="font-mono text-sm text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  retransmit.dev
                </a>
                , or plain REST from any language.
              </CheckItem>
            </ul>
            <a
              href={siteConfig.links.docs}
              className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
            >
              Read the docs →
            </a>
          </div>
          <CardTray>
            <CodeWindow
              tabs={[
                { label: "send-email.ts", code: sendNode },
                { label: "curl", code: sendCurl },
                { label: "response", code: sendResponse },
              ]}
            />
          </CardTray>
        </div>
      </Section>

      {/* Batch */}
      <Section>
        <SectionHeading
          eyebrow="Batch"
          title="Send one, or send ten thousand."
          lead="One request queues up to 10,000 emails. Poll the batch for per-status counts while the worker drains it at your provider's rate."
        />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          <CardTray className="order-last lg:order-first">
            <CodeWindow
              tabs={[
                { label: "batch.ts", code: batchNode },
                { label: "response", code: batchResponse },
              ]}
            />
          </CardTray>
          <ul className="flex flex-col gap-4 text-base leading-relaxed">
            <CheckItem>
              One HTTP call, thousands of messages — no loops, no client-side
              rate limiting, no partial-failure guesswork.
            </CheckItem>
            <CheckItem>
              Track progress with{" "}
              <code className="font-mono text-sm text-foreground">
                GET /v1/emails/batch/:id
              </code>{" "}
              — counts per status, updated live.
            </CheckItem>
            <CheckItem>
              Every message in the batch still gets its own id, log entry, and
              webhook events.
            </CheckItem>
          </ul>
        </div>
      </Section>

      {/* Webhooks */}
      <Section>
        <SectionHeading
          eyebrow="Webhooks"
          title="Know what happens to every email."
          lead="Nine event types, delivered to your endpoint as they happen — signed, timestamped, and retried until you acknowledge them."
        />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          <CardTray>
            <Card className="p-3">
              <EventFeed />
            </Card>
          </CardTray>
          <div>
            <CardTray>
              <CodeWindow
                tabs={[{ label: "email.delivered", code: webhookPayload }]}
              />
            </CardTray>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Payloads are signed with HMAC-SHA256 over{" "}
              <code className="font-mono text-xs">
                {"`${timestamp}.${body}`"}
              </code>{" "}
              and retried up to 8 times with exponential backoff.{" "}
              <a
                href={siteConfig.links.webhooks}
                className="font-medium text-primary hover:underline"
              >
                Verify in five lines →
              </a>
            </p>
          </div>
        </div>
      </Section>

      {/* Features grid */}
      <Section id="features">
        <SectionHeading
          eyebrow="Deliverability"
          title="Reach the inbox, not the spam folder."
          lead="The unglamorous parts of email — authentication, suppression, retries — handled the boring, correct way."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-6">
              <feature.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Open source / self-host */}
      <Section>
        <SectionHeading
          eyebrow="Open source"
          title="Run it yourself. Read every line."
          lead="The API, dashboard, queue, and SDK are all in one repository. Same API either way — switching between cloud and self-hosted is a base-URL change, not a rewrite."
        />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          <CardTray>
            <CodeWindow tabs={[{ label: "terminal", code: selfHostTerminal }]} />
          </CardTray>
          <div className="grid gap-4">
            <Card className="p-6">
              <h3 className="text-base font-semibold tracking-tight">
                Retransmit Cloud
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Managed sending on our infrastructure. Prepaid credits, one
                balance — fund it in local currencies, by bank transfer or
                mobile money. No international card required.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-base font-semibold tracking-tight">
                Self-hosted
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your servers, your keys, your data. Bring your own provider
                credentials and keep the same SDK, dashboard, and webhooks.
              </p>
            </Card>
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing">
        <SectionHeading
          eyebrow="Pricing"
          title="Pay for what you send."
          lead="No subscriptions, no seats, no charge for storing contacts. Top up a credit balance and it only moves when a message does."
        />
        <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          <Card className="p-8">
            <h3 className="text-lg font-semibold tracking-tight">Self-hosted</h3>
            <p className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
              Free
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Forever, on your own infrastructure. Every feature, no license
              key, no phone-home.
            </p>
            <CtaButton
              href={siteConfig.links.github}
              tone="quiet"
              size="sm"
              external
              className="mt-6"
            >
              View on GitHub
            </CtaButton>
          </Card>
          <Card className="p-8">
            <h3 className="text-lg font-semibold tracking-tight">Cloud</h3>
            <p className="mt-1 font-heading text-3xl font-extrabold tracking-tight">
              Prepaid credits
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              One balance across every channel. Fund it in your local currency —
              bank transfer and mobile money included.
            </p>
            <CtaButton href={siteConfig.links.quickstart} size="sm" className="mt-6">
              Get started
            </CtaButton>
          </Card>
        </div>
      </Section>

      {/* Final CTA */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl text-balance md:text-5xl">Ready to send?</h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-relaxed text-balance text-muted-foreground">
            Verify a domain, grab an API key, and send your first email in
            under five minutes.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <CtaButton href={siteConfig.links.quickstart}>Get started</CtaButton>
            <CtaButton href={siteConfig.links.docs} tone="quiet">
              Read the docs
            </CtaButton>
          </div>
        </div>
      </Section>
    </>
  );
}
