import type { Metadata } from "next";

import {
  Check,
  Fingerprint,
  KeyRound,
  Mail,
  MailCheck,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import { Card, CardTray } from "@/components/marketing/card";
import { CodeWindow } from "@/components/marketing/code-window";
import { CtaButton } from "@/components/marketing/cta-button";
import { EventFeed } from "@/components/marketing/event-feed";
import { Section, SectionHeading } from "@/components/marketing/section";
import {
  batchNode,
  batchResponse,
  selfHostTerminal,
  sendCurl,
  sendNode,
  sendResponse,
  smsNode,
  smsResponse,
  webhookPayload,
} from "@/components/marketing/snippets";
import { siteConfig } from "@/lib/site";

/* The canonical lives here, not in the root layout: root metadata is
   inherited, so a canonical there would make every page claim "/". */
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    /* .md sibling for agents that follow rel=alternate rather than
       sending Accept: text/markdown. */
    types: { "text/markdown": "/index.md" },
  },
};

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

/* The channel roadmap. Flip a status here when a channel ships; the cards
   and the JSON-LD stay in sync by hand, see structured-data.tsx. */
const CHANNELS = [
  {
    icon: Mail,
    title: "Email",
    status: "live",
    body: "Transactional email with domain verification, batch sending, and full event history.",
  },
  {
    icon: MessageSquareText,
    title: "SMS",
    status: "live",
    body: "Text messages routed per country to the cheapest provider, with delivery receipts.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    status: "soon",
    body: "Template and session messages through the same API and balance.",
  },
  {
    icon: Fingerprint,
    title: "OTP",
    status: "planned",
    body: "One-time codes with generation, delivery, and verification handled for you.",
  },
] as const;

const CHANNEL_BADGE = {
  live: { label: "Live", className: "bg-primary/10 text-primary" },
  soon: { label: "Coming soon", className: "bg-muted text-muted-foreground" },
  planned: { label: "Planned", className: "bg-muted text-muted-foreground" },
} as const;

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Domain verification",
    body: "Verify your sending domain with SPF and DKIM. The dashboard gives you exact records to copy.",
  },
  {
    icon: MailCheck,
    title: "Bounce & complaint handling",
    body: "Hard bounces and complaints are caught automatically. Your sender reputation is protected without extra code.",
  },
  {
    icon: RefreshCw,
    title: "Queue with retries",
    body: "Every send is queued, rate aware, and retried with exponential backoff.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    body: "Every event is delivered with an HMAC-SHA256 signature and retried up to 8 times with exponential backoff.",
  },
  {
    icon: ScrollText,
    title: "Logs & status",
    body: "Fetch any message by id and read its full event history, from queued to delivered, opened, or bounced.",
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
          <h1 className="text-4xl text-balance md:text-6xl">
            One API. Every message.
          </h1>
          <p className="mx-auto mt-5 max-w-[42ch] text-lg leading-relaxed text-balance text-muted-foreground">
            Send transactional email and SMS from one API and one prepaid
            balance. WhatsApp is next.
          </p>
          <div className="mt-9 flex justify-center">
            <CtaButton href={siteConfig.links.quickstart}>Get started</CtaButton>
          </div>
        </div>
      </section>

      {/* Channels */}
      <Section id="channels">
        <SectionHeading
          eyebrow="Channels"
          title="Integrate once. Add channels, not vendors."
          lead="Every channel shares the same key, SDK, webhooks, and balance. New ones arrive as an SDK update, not another account."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((channel) => {
            const badge = CHANNEL_BADGE[channel.status];
            return (
              <Card key={channel.title} className="p-6">
                <div className="flex items-center justify-between">
                  <channel.icon className="size-5 text-primary" aria-hidden />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {channel.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {channel.body}
                </p>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Send */}
      <Section>
        <SectionHeading
          eyebrow="Email"
          title="One request. Email delivered."
          lead="Verify a domain, grab an API key, and send your first email in under five minutes."
        />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <ul className="flex flex-col gap-4 text-base leading-relaxed">
              <CheckItem>
                Every call returns{" "}
                <code className="font-mono text-sm text-foreground">
                  {"{ data, error }"}
                </code>
                . No thrown surprises.
              </CheckItem>
              <CheckItem>
                Sends return a{" "}
                <code className="font-mono text-sm text-foreground">202</code>{" "}
                in milliseconds and are delivered by a rate-aware worker.
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
              One HTTP call for thousands of messages. No loops, no client-side
              rate limiting.
            </CheckItem>
            <CheckItem>
              Track progress with{" "}
              <code className="font-mono text-sm text-foreground">
                GET /v1/emails/batch/:id
              </code>
              . Counts per status, updated live.
            </CheckItem>
            <CheckItem>
              Every message in the batch still gets its own id, log entry, and
              webhook events.
            </CheckItem>
          </ul>
        </div>
      </Section>

      {/* SMS */}
      <Section>
        <SectionHeading
          eyebrow="SMS"
          title="Text the same way you email."
          lead="Same SDK, same response shape, same balance. Pass a number in international format and Retransmit routes the rest."
        />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <ul className="flex flex-col gap-4 text-base leading-relaxed">
              <CheckItem>
                The destination country is detected from the number and each
                message is routed to the cheapest configured provider.
              </CheckItem>
              <CheckItem>
                Set your own sender id, up to 11 characters, or use the
                route&apos;s default.
              </CheckItem>
              <CheckItem>
                Delivery receipts come back as{" "}
                <code className="font-mono text-sm text-foreground">
                  sms.delivered
                </code>{" "}
                webhooks and in the message&apos;s event history.
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
                { label: "send-sms.ts", code: smsNode },
                { label: "response", code: smsResponse },
              ]}
            />
          </CardTray>
        </div>
      </Section>

      {/* Webhooks */}
      <Section>
        <SectionHeading
          eyebrow="Webhooks"
          title="Know what happens to every message."
          lead="Email and SMS events, signed and timestamped, delivered to your endpoint as they happen."
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
          lead="Authentication, suppression, and retries handled correctly by default."
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
          lead="The API, dashboard, queue, and SDK live in one repository. Moving between cloud and self-hosted is a base URL change."
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
                Managed sending on our infrastructure. Fund one prepaid balance
                by bank transfer or mobile money. No international card
                required.
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
              One balance across every channel. Fund it in your local currency,
              including bank transfer and mobile money.
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
            Grab an API key and send your first email or SMS in under five
            minutes.
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
