import { cn } from "@/lib/utils";

/* A live delivery feed: the list rendered twice inside a masked viewport,
   drifting upward on a seamless loop. Reduced-motion readers get the rows
   standing still (the global reduced-motion block freezes the animation). */

type FeedEvent = {
  type: string;
  to: string;
  time: string;
  tone: "muted" | "ok" | "signal" | "bad";
};

const EVENTS: FeedEvent[] = [
  { type: "email.sent", to: "amara@nkolo.co", time: "12:00:01", tone: "muted" },
  { type: "email.delivered", to: "amara@nkolo.co", time: "12:00:03", tone: "ok" },
  { type: "email.opened", to: "amara@nkolo.co", time: "12:04:11", tone: "signal" },
  { type: "email.sent", to: "jonas@acme.dev", time: "12:00:02", tone: "muted" },
  { type: "email.delivered", to: "jonas@acme.dev", time: "12:00:05", tone: "ok" },
  { type: "email.clicked", to: "jonas@acme.dev", time: "12:06:48", tone: "signal" },
  { type: "email.sent", to: "old-address@example.com", time: "12:00:02", tone: "muted" },
  { type: "email.bounced", to: "old-address@example.com", time: "12:00:04", tone: "bad" },
  { type: "email.sent", to: "fatou@kossam.io", time: "12:00:03", tone: "muted" },
  { type: "email.delivered", to: "fatou@kossam.io", time: "12:00:06", tone: "ok" },
  { type: "email.opened", to: "fatou@kossam.io", time: "12:11:29", tone: "signal" },
  { type: "email.delivery_delayed", to: "sam@slowmail.net", time: "12:00:09", tone: "muted" },
];

const DOT = {
  muted: "bg-muted-foreground/50",
  ok: "bg-emerald-500",
  signal: "bg-primary",
  bad: "bg-destructive",
} as const;

function Row({ event }: { event: FeedEvent }) {
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

export function EventFeed({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-[360px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]",
        className,
      )}
    >
      <div className="motion-safe:animate-event-feed">
        {[0, 1].map((pass) => (
          <ul key={pass} className="flex flex-col gap-2 py-1">
            {EVENTS.map((event, i) => (
              <Row key={`${pass}-${i}`} event={event} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
