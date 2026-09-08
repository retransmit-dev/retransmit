import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { smsRate, whatsappRate } from "@retransmit/db/schema/billing";
import type { WhatsappBillingCategory } from "@retransmit/db/schema/billing";
import { AWS_SMS_COST_FALLBACK_MICROS, AWS_SMS_COST_MICROS } from "@retransmit/sms/aws-prices";
import { sql } from "drizzle-orm";

import {
  RATE_SEED_GENERATED_AT,
  SMS_RATE_SEED,
  SMS_RATE_SEED_TUNED,
  WHATSAPP_RATE_SEED,
} from "./seed-rates";

/**
 * Turning a message into billable units.
 *
 * A Stripe price cannot vary by destination, so the `retransmit_sms` and
 * `retransmit_whatsapp` meters carry money instead of messages: one unit is USD
 * 0.0001, and the price charges 0.01 cents per unit. The rate card therefore
 * lives here and in `sms_rate` / `whatsapp_rate`, where it can be per country,
 * and Stripe still does the rating and invoicing.
 *
 * Prices are held in USD micros (1_000_000 = $1.00) rather than meter units so
 * the stored number is the one an operator types in the admin editor, and the
 * conversion to Stripe's coarser unit happens once, at the end.
 *
 * Email needs none of this — it is one unit per recipient and the plan's
 * graduated price holds the allowance and the overage rate.
 */

/** How many meter units make one US dollar. */
export const UNITS_PER_USD = 10_000;
/** How many micros make one US dollar. */
export const MICROS_PER_USD = 1_000_000;
/** Micros in one meter unit. */
const MICROS_PER_UNIT = MICROS_PER_USD / UNITS_PER_USD;

/** Cents, for display. Rounds to the nearest cent the way an invoice would. */
export function unitsToCents(units: number): number {
  return Math.round((units / UNITS_PER_USD) * 100);
}

export function microsToUnits(micros: number): number {
  return Math.round(micros / MICROS_PER_UNIT);
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Multiple applied to the carrier's list price to get the seeded customer
 * price. Only ever used to *derive* a starting point: once a rate is in
 * `sms_rate` the stored number is what bills, and an operator undercutting this
 * because of a direct carrier deal is the expected case, not an exception.
 */
function smsMargin(): number {
  return envNumber("SMS_PRICE_MARGIN", 1.6);
}

/** AWS's list price for a destination, in micros. The one route covering everywhere. */
export function smsCostMicros(country: string | null): number {
  if (!country) return AWS_SMS_COST_FALLBACK_MICROS;
  return AWS_SMS_COST_MICROS[country.toUpperCase()] ?? AWS_SMS_COST_FALLBACK_MICROS;
}

/**
 * The price a destination gets when `sms_rate` has no row for it. Rounded up to
 * a whole meter unit so the rounding can never land under the intended margin.
 */
export function defaultSmsPriceMicros(country: string | null): number {
  const target = smsCostMicros(country) * smsMargin();
  return Math.ceil(target / MICROS_PER_UNIT) * MICROS_PER_UNIT;
}

/**
 * Per-category price used until Meta's real numbers are in `whatsapp_rate`.
 * Meta publishes its rate card only through an interactive tool, so these are
 * placeholders chosen to sit above the AWS pass-through, not quoted rates.
 * Marketing is the dearest category and service replies the cheapest.
 */
const WHATSAPP_DEFAULT_MICROS: Record<WhatsappBillingCategory, number> = {
  marketing: 40_000,
  utility: 20_000,
  authentication: 20_000,
  service: 10_000,
};

export function defaultWhatsappPriceMicros(category: WhatsappBillingCategory): number {
  return WHATSAPP_DEFAULT_MICROS[category];
}

/**
 * Rates are read on every send, so they are cached in process. The window is
 * short because an operator changing a price in the admin editor expects it to
 * take effect without a deploy, and a minute of staleness on a rate change is
 * cheaper than a database round trip per message.
 */
const CACHE_MS = 60_000;

interface RateCache<K> {
  loadedAt: number;
  rates: Map<K, number>;
}

let smsCache: RateCache<string> | null = null;
let whatsappCache: RateCache<string> | null = null;

/** Drops the cached rates. Called after an admin edit so it applies at once. */
export function invalidateRateCache(): void {
  smsCache = null;
  whatsappCache = null;
}

async function smsRates(): Promise<Map<string, number>> {
  if (smsCache && Date.now() - smsCache.loadedAt < CACHE_MS) return smsCache.rates;
  const rows = await db
    .select({ country: smsRate.country, priceMicros: smsRate.priceMicros })
    .from(smsRate);
  const rates = new Map(rows.map((row) => [row.country, row.priceMicros]));
  smsCache = { loadedAt: Date.now(), rates };
  return rates;
}

const whatsappKey = (country: string | null, category: WhatsappBillingCategory) =>
  `${country?.toUpperCase() ?? "??"}:${category}`;

async function whatsappRates(): Promise<Map<string, number>> {
  if (whatsappCache && Date.now() - whatsappCache.loadedAt < CACHE_MS) return whatsappCache.rates;
  const rows = await db
    .select({
      country: whatsappRate.country,
      category: whatsappRate.category,
      priceMicros: whatsappRate.priceMicros,
    })
    .from(whatsappRate);
  const rates = new Map(
    rows.map((row) => [whatsappKey(row.country, row.category), row.priceMicros]),
  );
  whatsappCache = { loadedAt: Date.now(), rates };
  return rates;
}

/** Customer price per SMS segment to a destination, in micros. */
export async function smsPriceMicros(country: string | null): Promise<number> {
  const stored = country ? (await smsRates()).get(country.toUpperCase()) : undefined;
  return stored ?? defaultSmsPriceMicros(country);
}

/** Customer price for one WhatsApp message, in micros. */
export async function whatsappPriceMicros(
  country: string | null,
  category: WhatsappBillingCategory,
): Promise<number> {
  const stored = (await whatsappRates()).get(whatsappKey(country, category));
  return stored ?? defaultWhatsappPriceMicros(category);
}

/**
 * Billable units for an SMS send: the destination's rate, times the segments
 * the text was split into, times the recipients it went to.
 */
export async function smsUnits(
  country: string | null,
  segments: number,
  recipients = 1,
): Promise<number> {
  const micros = await smsPriceMicros(country);
  return microsToUnits(micros * Math.max(1, segments) * Math.max(1, recipients));
}

/** Billable units for one WhatsApp message. */
export async function whatsappUnits(
  country: string | null,
  category: WhatsappBillingCategory,
): Promise<number> {
  return microsToUnits(await whatsappPriceMicros(country, category));
}

/**
 * Every destination the seed knows a price for: the checked-in snapshot first,
 * then anything AWS lists that the snapshot predates.
 *
 * A snapshotted price carries an operator's judgement — a country with a direct
 * carrier deal is worth a fraction of AWS's list — so it wins over the derived
 * default. Countries only AWS knows about still get one, which is what lets a
 * refreshed price list add destinations without re-snapshotting.
 */
function seedRows(): { country: string; priceMicros: number; costMicros: number }[] {
  const countries = new Set([...Object.keys(SMS_RATE_SEED), ...Object.keys(AWS_SMS_COST_MICROS)]);
  return [...countries].map((country) => ({
    country,
    priceMicros: SMS_RATE_SEED[country] ?? defaultSmsPriceMicros(country),
    costMicros: smsCostMicros(country),
  }));
}

export interface RateSeedStatus {
  /** Destinations the seed can supply. */
  total: number;
  /** How many of those this database has no row for. */
  missing: number;
  /** WhatsApp overrides in the seed that this database has no row for. */
  missingWhatsapp: number;
  /** Of the SMS rates in the seed, how many were priced by hand. */
  tuned: number;
  generatedAt: string;
}

/** What pressing "seed" would do, without doing it. */
export async function rateSeedStatus(): Promise<RateSeedStatus> {
  const rows = seedRows();
  const present = new Set((await db.select({ country: smsRate.country }).from(smsRate)).map((r) => r.country));
  const existingWhatsapp = new Set(
    (
      await db
        .select({ country: whatsappRate.country, category: whatsappRate.category })
        .from(whatsappRate)
    ).map((row) => `${row.country}:${row.category}`),
  );
  return {
    total: rows.length,
    missing: rows.filter((row) => !present.has(row.country)).length,
    missingWhatsapp: WHATSAPP_RATE_SEED.filter(
      (row) => !existingWhatsapp.has(`${row.country}:${row.category}`),
    ).length,
    tuned: SMS_RATE_SEED_TUNED.length,
    generatedAt: RATE_SEED_GENERATED_AT,
  };
}

/**
 * Writes the seed rate card into `sms_rate` and `whatsapp_rate`, leaving
 * existing rows alone.
 *
 * Insert-only by design. This runs on every boot and from a button on a
 * production admin page, and in both cases the database may already hold prices
 * someone has corrected since the snapshot was taken. Overwriting those would
 * silently undo the correction, so a destination that already has a row is
 * never touched — changing a live price is what the rate editor is for.
 */
export async function seedSmsRates(): Promise<number> {
  const inserted = await db
    .insert(smsRate)
    .values(seedRows().map((row) => ({ ...row, source: "seed" as const })))
    .onConflictDoNothing({ target: smsRate.country })
    .returning({ country: smsRate.country });

  if (inserted.length > 0) invalidateRateCache();
  return inserted.length;
}

/** The WhatsApp half of the seed. Empty until overrides have been snapshotted. */
export async function seedWhatsappRates(): Promise<number> {
  if (WHATSAPP_RATE_SEED.length === 0) return 0;

  const inserted = await db
    .insert(whatsappRate)
    .values(
      WHATSAPP_RATE_SEED.map((row) => ({
        id: createId("wr"),
        country: row.country,
        category: row.category,
        priceMicros: row.priceMicros,
        source: "seed" as const,
      })),
    )
    .onConflictDoNothing({ target: [whatsappRate.country, whatsappRate.category] })
    .returning({ id: whatsappRate.id });

  if (inserted.length > 0) invalidateRateCache();
  return inserted.length;
}

/**
 * Refreshes the *cost* column on seeded rows from the current AWS list, so the
 * margin the admin editor shows stays honest after a price list refresh.
 * Customer prices are never touched, including on rows still marked `seed`.
 */
export async function refreshSmsCosts(): Promise<number> {
  const entries = Object.entries(AWS_SMS_COST_MICROS);
  if (entries.length === 0) return 0;

  // A join against a VALUES list rather than a 246-branch CASE: one statement,
  // and `is distinct from` means an unchanged price list updates no rows at all.
  const values = sql.join(
    entries.map(([country, cost]) => sql`(${country}::text, ${cost}::integer)`),
    sql`, `,
  );
  const updated = await db.execute<{ country: string }>(sql`
    update sms_rate
       set cost_micros = v.cost, updated_at = now()
      from (values ${values}) as v(country, cost)
     where sms_rate.country = v.country
       and sms_rate.cost_micros is distinct from v.cost
    returning sms_rate.country
  `);
  return updated.rowCount ?? 0;
}

/** A `whatsapp_rate` row id. Exposed so the admin router can create rows. */
export function createWhatsappRateId(): string {
  return createId("wr");
}
