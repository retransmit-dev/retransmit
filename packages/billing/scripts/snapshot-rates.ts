/**
 * Freezes the rate card in the database this runs against into
 * `src/seed-rates.ts`, which is what seeding writes into an empty database.
 *
 *   pnpm --filter @retransmit/billing rates:snapshot
 *
 * The point is the prices an operator has *tuned*. Boot-seeding derives a
 * starting price from AWS's list, but a country with a direct carrier deal is
 * priced by hand — Cameroon is $0.29 on AWS and worth about $0.05 over MTN —
 * and none of that judgement survives into a fresh database unless it is
 * checked in. So: tune rates in the admin editor, run this, commit the diff,
 * deploy, then press "Seed missing" on the remote admin page.
 *
 * Only ever adds to what a database already has (see `seedSmsRates`), so a
 * stale snapshot cannot overwrite a price someone has since corrected.
 */
import { db } from "@retransmit/db";
import { smsRate, whatsappRate } from "@retransmit/db/schema/billing";
import { asc } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const sms = await db
    .select({
      country: smsRate.country,
      priceMicros: smsRate.priceMicros,
      source: smsRate.source,
    })
    .from(smsRate)
    .orderBy(asc(smsRate.country));

  const whatsapp = await db
    .select({
      country: whatsappRate.country,
      category: whatsappRate.category,
      priceMicros: whatsappRate.priceMicros,
    })
    .from(whatsappRate)
    .orderBy(asc(whatsappRate.country), asc(whatsappRate.category));

  if (sms.length === 0) {
    throw new Error("No rows in sms_rate — nothing to snapshot. Boot the API once to seed it.");
  }

  const tuned = sms.filter((row) => row.source === "manual").length;
  const body = `${HEADER}
export const RATE_SEED_GENERATED_AT = "${new Date().toISOString().slice(0, 10)}";

/** Customer price per SMS segment, USD micros, by destination. */
export const SMS_RATE_SEED: Readonly<Record<string, number>> = {
${sms.map((row) => `  ${row.country}: ${row.priceMicros},`).join("\n")}
};

/** Destinations whose price was set by hand rather than derived from AWS. */
export const SMS_RATE_SEED_TUNED: readonly string[] = [
${sms
  .filter((row) => row.source === "manual")
  .map((row) => `  "${row.country}",`)
  .join("\n")}
];

/** WhatsApp overrides, per destination and category. USD micros per message. */
export const WHATSAPP_RATE_SEED: readonly {
  country: string;
  category: "marketing" | "utility" | "authentication" | "service";
  priceMicros: number;
}[] = [
${whatsapp
  .map(
    (row) =>
      `  { country: "${row.country}", category: "${row.category}", priceMicros: ${row.priceMicros} },`,
  )
  .join("\n")}
];
`;

  const out = join(import.meta.dirname, "..", "src", "seed-rates.ts");
  writeFileSync(out, body);
  console.log(
    `Wrote ${sms.length} SMS rates (${tuned} hand-tuned) and ` +
      `${whatsapp.length} WhatsApp overrides to ${out}`,
  );
}

const HEADER = `/**
 * The rate card a fresh database starts with.
 *
 * Snapshotted from a running deployment rather than computed, so that prices an
 * operator set by hand survive into a new environment. A country with a direct
 * carrier deal is worth a fraction of AWS's list price, and that judgement
 * exists nowhere else.
 *
 * Seeding only inserts destinations a database is missing; it never overwrites
 * a price already there. Countries absent here but present in
 * \`@retransmit/sms/aws-prices\` still get their AWS-derived default, so a
 * refreshed price list adds new destinations without a re-snapshot.
 *
 * Generated — do not edit. Refresh with
 * \`pnpm --filter @retransmit/billing rates:snapshot\`.
 */`;

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
