import { Mail, MessageCircle, MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The left half of the sign-in screen: what Retransmit does, drawn rather
 * than described. One send call goes in, delivery events come out. Pure
 * markup and CSS, so it renders on the server and costs no JavaScript.
 */

const CHANNELS = [
  { icon: Mail, label: "Email" },
  { icon: MessageSquareText, label: "SMS" },
  { icon: MessageCircle, label: "WhatsApp" },
] as const;

type FeedEvent = {
  type: string;
  to: string;
  time: string;
  tone: "muted" | "ok" | "signal" | "bad";
};

const EVENTS: FeedEvent[] = [
  { type: "email.sent", to: "amara@nkolo.co", time: "12:00:01", tone: "muted" },
  { type: "email.delivered", to: "amara@nkolo.co", time: "12:00:03", tone: "ok" },
  { type: "sms.sent", to: "+237 6 70 •• •• 00", time: "12:00:02", tone: "muted" },
  { type: "sms.delivered", to: "+237 6 70 •• •• 00", time: "12:00:04", tone: "ok" },
  { type: "email.opened", to: "amara@nkolo.co", time: "12:04:11", tone: "signal" },
  { type: "whatsapp.sent", to: "+221 77 ••• •• 12", time: "12:00:05", tone: "muted" },
  { type: "whatsapp.delivered", to: "+221 77 ••• •• 12", time: "12:00:06", tone: "ok" },
  { type: "email.sent", to: "jonas@acme.dev", time: "12:00:02", tone: "muted" },
  { type: "email.delivered", to: "jonas@acme.dev", time: "12:00:05", tone: "ok" },
  { type: "email.clicked", to: "jonas@acme.dev", time: "12:06:48", tone: "signal" },
  { type: "email.sent", to: "old-address@example.com", time: "12:00:02", tone: "muted" },
  { type: "email.bounced", to: "old-address@example.com", time: "12:00:04", tone: "bad" },
  { type: "whatsapp.read", to: "+221 77 ••• •• 12", time: "12:01:40", tone: "signal" },
  { type: "email.sent", to: "fatou@kossam.io", time: "12:00:03", tone: "muted" },
  { type: "email.delivered", to: "fatou@kossam.io", time: "12:00:06", tone: "ok" },
  { type: "sms.sent", to: "+254 7 12 ••• •• 9", time: "12:00:07", tone: "muted" },
];

const DOT = {
  muted: "bg-muted-foreground/50",
  ok: "bg-emerald-500",
  signal: "bg-primary",
  bad: "bg-destructive",
} as const;

function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-primary">{children}</span>;
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function SendWindow() {
  return (
    <div className="overflow-hidden rounded-[1rem] bg-card shadow-card">
      <div className="flex items-center gap-3 border-b-[0.5px] border-foreground/5 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
          send.ts
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        <code>
          <Kw>await</Kw> retransmit.emails.send({"{"}{"\n"}
          {"  "}from: <Str>"Acme &lt;hello@acme.dev&gt;"</Str>,{"\n"}
          {"  "}to: <Str>"amara@nkolo.co"</Str>,{"\n"}
          {"  "}subject: <Str>"Your receipt"</Str>,{"\n"}
          {"}"});
        </code>
      </pre>
    </div>
  );
}

function FeedRow({ event }: { event: FeedEvent }) {
  return (
    <li className="flex items-center gap-3 rounded-[10px] bg-background/60 px-3 py-2">
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[event.tone])} />
      <span className="font-mono text-xs text-foreground">{event.type}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {event.to}
      </span>
      <span className="font-mono text-xs text-muted-foreground/70">
        {event.time}
      </span>
    </li>
  );
}

/* The list rendered twice inside a masked viewport, drifting upward on a
   seamless loop. Reduced-motion readers see it standing still. */
function EventFeed() {
  return (
    <div
      aria-hidden
      className="h-[232px] overflow-hidden rounded-[1rem] bg-card p-2 shadow-card [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_88%,transparent)]"
    >
      <div className="motion-safe:animate-event-feed">
        {[0, 1].map((pass) => (
          <ul key={pass} className="flex flex-col gap-1.5 py-1">
            {EVENTS.map((event, i) => (
              <FeedRow key={`${pass}-${i}`} event={event} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function LoginShowcase() {
  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <div>
        <h2 className="text-3xl text-balance">One API. Every message.</h2>
        <p className="mt-3 text-base leading-relaxed text-balance text-muted-foreground">
          Email, SMS and WhatsApp from one endpoint.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {CHANNELS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground shadow-card"
            >
              <Icon className="size-3.5 text-primary" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5 rounded-[1.3rem] bg-tray p-1.5 shadow-tray">
        <SendWindow />
        <EventFeed />
      </div>
    </div>
  );
}
