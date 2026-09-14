import { db } from "@retransmit/db";
import { email, emailEvent } from "@retransmit/db/schema/email";
import type { BounceReason, MailboxProvider, WebhookEventType } from "@retransmit/db/schema/email";
import { and, count, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

export const ANALYTICS_METRICS = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
] as const;
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

const EVENT_METRIC_MAP: Partial<Record<WebhookEventType, AnalyticsMetric>> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};
const TRACKED_EVENT_TYPES = Object.keys(EVENT_METRIC_MAP) as WebhookEventType[];

/** Ranges up to this long are bucketed hourly; anything longer daily. */
const HOURLY_RANGE_MS = 2 * 24 * 60 * 60 * 1000;

/** One mailbox provider's numbers over the window. */
export type ProviderRow = Record<AnalyticsMetric, number> & {
  provider: MailboxProvider;
  /** Why this provider bounced us, commonest first. */
  bounceReasons: { reason: BounceReason; count: number }[];
};

const emptyCounts = () =>
  Object.fromEntries(ANALYTICS_METRICS.map((metric) => [metric, 0])) as Record<
    AnalyticsMetric,
    number
  >;

export const analyticsRouter = router({
  /**
   * Counts and a time series for the requested window. "Sent" counts emails
   * created in the window; the other metrics count distinct emails with a
   * matching event in the window, so an email opened three times counts once.
   */
  overview: protectedProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        domainId: z.string().optional(),
        /** IANA zone used to align buckets with the viewer's calendar days. */
        timeZone: z
          .string()
          .max(64)
          .regex(/^[A-Za-z0-9_+/:-]+$/)
          .default("UTC"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const interval =
        input.to.getTime() - input.from.getTime() <= HOURLY_RANGE_MS ? "hour" : "day";
      const format = interval === "hour" ? 'YYYY-MM-DD"T"HH24' : "YYYY-MM-DD";
      // Timestamps are stored as UTC-naive; shift into the viewer's zone
      // before truncating so a "day" matches their calendar day.
      const bucketOf = (column: typeof email.createdAt | typeof emailEvent.createdAt) =>
        sql<string>`to_char((${column} at time zone 'UTC') at time zone ${input.timeZone}, ${format})`;
      const distinctEmails = sql<number>`count(distinct ${emailEvent.emailId})`.mapWith(Number);

      const emailConditions = [
        eq(email.userId, ctx.session.user.id),
        gte(email.createdAt, input.from),
        lte(email.createdAt, input.to),
      ];
      if (input.domainId) emailConditions.push(eq(email.domainId, input.domainId));

      const eventConditions = [
        eq(email.userId, ctx.session.user.id),
        gte(emailEvent.createdAt, input.from),
        lte(emailEvent.createdAt, input.to),
        inArray(emailEvent.type, TRACKED_EVENT_TYPES),
      ];
      if (input.domainId) eventConditions.push(eq(email.domainId, input.domainId));

      const [sentBuckets, eventBuckets, sentTotal, eventTotals] = await Promise.all([
        db
          .select({ bucket: bucketOf(email.createdAt), count: count() })
          .from(email)
          .where(and(...emailConditions))
          // Positional: repeating bucketOf() would bind fresh placeholders,
          // which Postgres no longer matches to the select expression.
          .groupBy(sql`1`),
        db
          .select({
            bucket: bucketOf(emailEvent.createdAt),
            type: emailEvent.type,
            count: distinctEmails,
          })
          .from(emailEvent)
          .innerJoin(email, eq(emailEvent.emailId, email.id))
          .where(and(...eventConditions))
          .groupBy(sql`1`, emailEvent.type),
        db
          .select({ count: count() })
          .from(email)
          .where(and(...emailConditions)),
        db
          .select({ type: emailEvent.type, count: distinctEmails })
          .from(emailEvent)
          .innerJoin(email, eq(emailEvent.emailId, email.id))
          .where(and(...eventConditions))
          .groupBy(emailEvent.type),
      ]);

      const totals = emptyCounts();
      totals.sent = sentTotal[0]?.count ?? 0;
      for (const row of eventTotals) {
        const metric = EVENT_METRIC_MAP[row.type];
        if (metric) totals[metric] = row.count;
      }

      const buckets = new Map<string, Record<AnalyticsMetric, number>>();
      const bucketFor = (key: string) => {
        let entry = buckets.get(key);
        if (!entry) {
          entry = emptyCounts();
          buckets.set(key, entry);
        }
        return entry;
      };
      for (const row of sentBuckets) bucketFor(row.bucket).sent = row.count;
      for (const row of eventBuckets) {
        const metric = EVENT_METRIC_MAP[row.type];
        if (metric) bucketFor(row.bucket)[metric] = row.count;
      }

      const series = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucket, counts]) => ({ bucket, ...counts }));

      return { interval, totals, series };
    }),

  /**
   * Deliverability split by who runs the recipient's mailbox, plus the
   * bounce reasons behind it.
   *
   * No mailbox provider reports spam-folder placement back to a sender, so
   * this is the closest usable signal: a provider whose open rate sits well
   * below the others, on comparable volume, is filtering us into junk. The
   * bounce reasons say whether that is our sending reputation, our
   * authentication, or just dead addresses.
   */
  byProvider: protectedProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        domainId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(email.userId, ctx.session.user.id),
        gte(email.createdAt, input.from),
        lte(email.createdAt, input.to),
        // Rows that predate provider detection, or whose lookup failed, would
        // otherwise pile up in a meaningless "unknown" bucket.
        isNotNull(email.recipientProvider),
      ];
      if (input.domainId) conditions.push(eq(email.domainId, input.domainId));

      const distinctEmails = sql<number>`count(distinct ${emailEvent.emailId})`.mapWith(Number);

      const [sentRows, eventRows, reasonRows] = await Promise.all([
        db
          .select({ provider: email.recipientProvider, count: count() })
          .from(email)
          .where(and(...conditions))
          .groupBy(email.recipientProvider),
        // Events are counted against the email's own window rather than the
        // event's, so every column of a row describes the same set of sends.
        db
          .select({
            provider: email.recipientProvider,
            type: emailEvent.type,
            count: distinctEmails,
          })
          .from(emailEvent)
          .innerJoin(email, eq(emailEvent.emailId, email.id))
          .where(and(...conditions, inArray(emailEvent.type, TRACKED_EVENT_TYPES)))
          .groupBy(email.recipientProvider, emailEvent.type),
        db
          .select({
            provider: email.recipientProvider,
            reason: email.bounceReason,
            count: count(),
          })
          .from(email)
          .where(and(...conditions, isNotNull(email.bounceReason)))
          .groupBy(email.recipientProvider, email.bounceReason)
          .orderBy(desc(count())),
      ]);

      const rows = new Map<MailboxProvider, ProviderRow>();
      const rowFor = (provider: MailboxProvider) => {
        let entry = rows.get(provider);
        if (!entry) {
          entry = { provider, ...emptyCounts(), bounceReasons: [] };
          rows.set(provider, entry);
        }
        return entry;
      };

      for (const row of sentRows) {
        if (row.provider) rowFor(row.provider).sent = row.count;
      }
      for (const row of eventRows) {
        const metric = EVENT_METRIC_MAP[row.type];
        if (row.provider && metric) rowFor(row.provider)[metric] = row.count;
      }
      for (const row of reasonRows) {
        if (row.provider && row.reason) {
          rowFor(row.provider).bounceReasons.push({ reason: row.reason, count: row.count });
        }
      }

      return [...rows.values()].sort((a, b) => b.sent - a.sent);
    }),
});
