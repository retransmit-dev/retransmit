import {
  createWhatsappRateId,
  defaultSmsPriceMicros,
  defaultWhatsappPriceMicros,
  invalidateRateCache,
  rateSeedStatus,
  seedSmsRates,
  seedWhatsappRates,
  smsCostMicros,
} from "@retransmit/billing/rates";
import { db } from "@retransmit/db";
import { session, user } from "@retransmit/db/schema/auth";
import { smsRate, whatsappRate } from "@retransmit/db/schema/billing";
import { WHATSAPP_BILLING_CATEGORIES } from "@retransmit/db/schema/billing";
import { AWS_SMS_PRICES_FETCHED_AT } from "@retransmit/sms/aws-prices";
import { SMS_COUNTRIES } from "@retransmit/sms/countries";
import { providerCoverage, selectProvider } from "@retransmit/sms/provider";
import { asc, count, desc, eq, max, sql } from "drizzle-orm";
import z from "zod";

import { adminProcedure, router } from "../index";

/**
 * A price typed into the admin editor, in dollars. Stored as micros, so four
 * decimal places is the finest the meter can express anyway.
 */
const priceUsd = z
  .number()
  .min(0)
  .max(10)
  .refine((value) => Number.isFinite(value), "Enter a price in dollars");

function toMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

/**
 * What a segment to this destination actually costs, on the route routing
 * would pick right now.
 *
 * Not the same as the AWS list price the rate card is seeded from. AWS is the
 * fallback that covers everywhere; where a direct carrier deal exists it is far
 * cheaper — Cameroon is $0.288 on AWS and about $0.01 over MTN — so judging
 * margin against AWS would flag every launch-footprint country as sold below
 * cost the moment it is priced competitively.
 *
 * For the SNS family the per-country AWS list beats asking the provider, whose
 * quote is one flat configured number for every destination it covers.
 */
function routeCostMicros(country: string): number {
  const listPrice = smsCostMicros(country);
  const provider = selectProvider(country, null);
  if (!provider || provider.family === "sns") return listPrice;
  const quoted = provider.costFor(country);
  return quoted === null ? listPrice : Math.round(quoted * 1_000_000);
}

export const adminRouter = router({
  /**
   * Every registered user with the last time they were seen. Better Auth
   * creates a session on each sign-in and bumps `updatedAt` when it extends
   * one, so the newest `updatedAt` across a user's sessions is their last
   * connection. Users who never signed in have none.
   */
  users: adminProcedure.query(async () => {
    const lastSeenAt = max(session.updatedAt);
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        lastSeenAt,
        activeSessions: count(
          sql`case when ${session.expiresAt} > now() then 1 end`,
        ),
      })
      .from(user)
      .leftJoin(session, eq(session.userId, user.id))
      .groupBy(user.id)
      .orderBy(sql`${lastSeenAt} desc nulls last`, desc(user.createdAt));

    return rows;
  }),

  /**
   * What SMS routing would do right now: which providers this deployment has
   * credentials for, what they cover and what they cost. Operator-only —
   * choosing a carrier is a cost decision Retransmit makes, not a customer
   * setting, so this answers "why did that go out over AWS" without a shell
   * on the server.
   */
  smsProviders: adminProcedure.query(() => providerCoverage()),

  /**
   * The SMS rate card: what each destination costs us and what a customer pays.
   *
   * Countries Retransmit actually offers come first — those are the ones worth
   * getting right — then everything else AWS lists. `belowCost` is the row that
   * needs attention: a price under the fallback carrier's own rate is money
   * lost on every message.
   */
  smsRates: adminProcedure.query(async () => {
    const rows = await db
      .select({
        country: smsRate.country,
        priceMicros: smsRate.priceMicros,
        costMicros: smsRate.costMicros,
        source: smsRate.source,
        updatedAt: smsRate.updatedAt,
      })
      .from(smsRate)
      .orderBy(asc(smsRate.country));

    const stored = new Map(rows.map((row) => [row.country, row]));
    const offered = new Map(SMS_COUNTRIES.map((entry) => [entry.code, entry]));
    const configured = providerCoverage().filter((entry) => entry.configured).length;

    // Every country we sell to appears even if the seed has not run, so the
    // editor never hides a destination that can already be sent to.
    const countries = new Set([...stored.keys(), ...offered.keys()]);
    const rates = [...countries].map((country) => {
      const row = stored.get(country);
      const priceMicros = row?.priceMicros ?? defaultSmsPriceMicros(country);
      const listMicros = row?.costMicros ?? smsCostMicros(country);
      const costMicros = routeCostMicros(country);
      return {
        country,
        name: offered.get(country)?.name ?? country,
        flag: offered.get(country)?.flag ?? null,
        offered: offered.has(country),
        priceMicros,
        /** Cost on the route routing would pick now. What margin is judged against. */
        costMicros,
        /** AWS's list price, the fallback that covers every destination. */
        listMicros,
        /** True when this destination is only reachable over the AWS fallback. */
        fallbackOnly: costMicros === listMicros,
        margin: costMicros > 0 ? priceMicros / costMicros : null,
        belowCost: priceMicros < costMicros,
        source: row?.source ?? "seed",
        updatedAt: row?.updatedAt ?? null,
      };
    });

    rates.sort((a, b) => {
      if (a.offered !== b.offered) return a.offered ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      rates,
      costsFetchedAt: AWS_SMS_PRICES_FETCHED_AT,
      configuredProviders: configured,
      seed: await rateSeedStatus(),
    };
  }),

  /**
   * Writes the checked-in rate card into any destination this database has no
   * price for.
   *
   * The API seeds itself at boot, so this exists for the case boot-seeding
   * cannot cover: a freshly migrated database that came up before the deploy
   * carrying the current snapshot, or one where the seed failed and nobody
   * wants to restart the process to retry it. Insert-only, so pressing it on a
   * deployment whose rates have been tuned changes nothing.
   */
  seedRates: adminProcedure.mutation(async () => {
    const sms = await seedSmsRates();
    const whatsapp = await seedWhatsappRates();
    return { sms, whatsapp };
  }),

  /** Sets what a customer pays per SMS segment to one destination. */
  setSmsRate: adminProcedure
    .input(z.object({ country: z.string().length(2).toUpperCase(), priceUsd }))
    .mutation(async ({ input }) => {
      const priceMicros = toMicros(input.priceUsd);
      const costMicros = smsCostMicros(input.country);
      await db
        .insert(smsRate)
        .values({ country: input.country, priceMicros, costMicros, source: "manual" })
        .onConflictDoUpdate({
          target: smsRate.country,
          // The cost column is refreshed from AWS separately; leave it alone.
          set: { priceMicros, source: "manual", updatedAt: new Date() },
        });
      // Sends read a cached rate card, so an edit has to drop it or the new
      // price takes up to a minute to apply.
      invalidateRateCache();
      return { country: input.country, priceMicros };
    }),

  /**
   * The WhatsApp rate card, one row per destination and category. Unlike SMS
   * this is not seeded — Meta publishes rates only through an interactive tool
   * — so rows exist only where an operator entered one, and everything else
   * shows the per-category default it currently bills at.
   */
  whatsappRates: adminProcedure.query(async () => {
    const rows = await db
      .select({
        id: whatsappRate.id,
        country: whatsappRate.country,
        category: whatsappRate.category,
        priceMicros: whatsappRate.priceMicros,
        updatedAt: whatsappRate.updatedAt,
      })
      .from(whatsappRate)
      .orderBy(asc(whatsappRate.country), asc(whatsappRate.category));

    return {
      overrides: rows,
      defaults: WHATSAPP_BILLING_CATEGORIES.map((category) => ({
        category,
        priceMicros: defaultWhatsappPriceMicros(category),
      })),
      countries: SMS_COUNTRIES.map((entry) => ({
        code: entry.code,
        name: entry.name,
        flag: entry.flag,
      })),
    };
  }),

  setWhatsappRate: adminProcedure
    .input(
      z.object({
        country: z.string().length(2).toUpperCase(),
        category: z.enum(WHATSAPP_BILLING_CATEGORIES),
        priceUsd,
      }),
    )
    .mutation(async ({ input }) => {
      const priceMicros = toMicros(input.priceUsd);
      await db
        .insert(whatsappRate)
        .values({
          id: createWhatsappRateId(),
          country: input.country,
          category: input.category,
          priceMicros,
          source: "manual",
        })
        .onConflictDoUpdate({
          target: [whatsappRate.country, whatsappRate.category],
          set: { priceMicros, source: "manual", updatedAt: new Date() },
        });
      invalidateRateCache();
      return { country: input.country, category: input.category, priceMicros };
    }),

  /** Drops an override so the destination falls back to the category default. */
  clearWhatsappRate: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(whatsappRate).where(eq(whatsappRate.id, input.id));
      invalidateRateCache();
      return { ok: true };
    }),
});
