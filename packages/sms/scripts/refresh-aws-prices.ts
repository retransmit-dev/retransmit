/**
 * Regenerates `src/aws-prices.ts` from AWS's published SMS price list.
 *
 *   pnpm --filter @retransmit/sms rates:refresh
 *
 * AWS does not expose per-country SMS rates through the Pricing API — the
 * `MessageFees` dimension there is a `unit: Dollar` pass-through, so querying
 * it returns 1.0 for every country. The real table is the CSV linked from the
 * pricing page, which is what this reads.
 *
 * Refreshing only changes the seed and the cost figures the admin editor
 * displays. Prices already in `sms_rate` are never touched: those are the
 * customer's price and only an operator changes them.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CSV_URL =
  process.env.AWS_SMS_PRICES_CSV_URL ??
  "https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/business-applications/approved/documents/End-User-Messaging-SMS-Prices.ebc340b4d416d90832dd59629c4792b0deb6f8bc.csv";

/**
 * The CSV is one row per country except for the three that bill a message
 * price and a carrier fee separately. For those, the cost is the sum on the
 * route we would actually use.
 */
function costFor(byNumberType: Map<string, number>, iso: string): number | null {
  const all = byNumberType.get("All number types");
  if (all !== undefined) return all;
  // Not an Indian entity, so sends there are international.
  if (iso === "IN") return byNumberType.get("India international") ?? null;
  for (const [base, fee] of [
    ["10DLC", "10DLC carrier fee"],
    ["Long code", "Long code carrier fee"],
  ] as const) {
    const price = byNumberType.get(base);
    if (price !== undefined) return price + (byNumberType.get(fee) ?? 0);
  }
  return null;
}

/**
 * Splits one CSV line, honouring quoted fields. Country names carry commas —
 * "Bonaire, Sint Eustatius and Saba" — so a plain `split(",")` shifts that
 * row's columns and drops the country.
 */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

function parse(csv: string): Map<string, Map<string, number>> {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = splitRow(header ?? "");
  const iso = columns.indexOf("ISO Country");
  const type = columns.indexOf("Number Type");
  const price = columns.findIndex((name) => name.startsWith("Price"));
  if (iso < 0 || type < 0 || price < 0) {
    throw new Error(`Unexpected CSV header: ${header}`);
  }

  const rows = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const cells = splitRow(line);
    const country = cells[iso];
    const amount = Number(cells[price]);
    // A row that does not parse is a format change, not something to skip:
    // dropping one silently prices that country off the expensive fallback.
    if (!country || !Number.isFinite(amount)) {
      throw new Error(`Could not read a price from CSV row: ${line}`);
    }
    const byType = rows.get(country) ?? new Map<string, number>();
    byType.set(cells[type] ?? "", amount);
    rows.set(country, byType);
  }
  return rows;
}

async function main() {
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Could not fetch the AWS price list: ${response.status} ${CSV_URL}`);
  }

  const parsed = parse(await response.text());
  const micros = new Map<string, number>();
  const unresolved: string[] = [];
  for (const [country, byType] of parsed) {
    const cost = costFor(byType, country);
    if (cost === null) unresolved.push(country);
    else micros.set(country, Math.round(cost * 1_000_000));
  }
  if (unresolved.length > 0) {
    throw new Error(`No usable number type for: ${unresolved.join(", ")}`);
  }
  if (micros.size < 200) {
    throw new Error(`Only ${micros.size} countries parsed; the CSV format probably changed`);
  }

  const sorted = [...micros].sort(([a], [b]) => a.localeCompare(b));
  const worst = Math.max(...micros.values());
  const fallback = Math.ceil(worst / 10_000) * 10_000;

  const body = `${HEADER}
export const AWS_SMS_PRICES_FETCHED_AT = "${new Date().toISOString().slice(0, 10)}";

export const AWS_SMS_COST_MICROS: Readonly<Record<string, number>> = {
${sorted.map(([country, value]) => `  ${country}: ${value},`).join("\n")}
};

/**
 * Fallback for a destination AWS does not list. Set above the most expensive
 * listed country so an unknown destination can never be sold below cost.
 */
export const AWS_SMS_COST_FALLBACK_MICROS = ${fallback};
`;

  const out = join(import.meta.dirname, "..", "src", "aws-prices.ts");
  writeFileSync(out, body);
  console.log(`Wrote ${micros.size} countries to ${out} (fallback ${fallback} micros)`);
}

const HEADER = `/**
 * AWS End User Messaging list price per SMS segment, in USD micros
 * (1_000_000 = $1.00), keyed by ISO 3166-1 alpha-2 destination.
 *
 * This is what a segment costs *Retransmit* on the global fallback route, not
 * what a customer pays. It exists for two reasons: it seeds \`sms_rate\` on first
 * run so no destination is ever unpriced, and the admin rate editor shows it
 * next to the customer price so the margin on a country is visible.
 *
 * Direct carrier deals (MTN, Orange) undercut these heavily in the launch
 * footprint — Cameroon is $0.288 here and a fraction of that over MTN — so a
 * country with a direct route is expected to be priced well under this number.
 * Seeded prices are derived from the AWS figure anyway: it is the one route
 * that covers everywhere, so pricing off it can never sell below the cost of
 * the fallback.
 *
 * Source: the "SMS pricing per country" CSV linked from
 * https://aws.amazon.com/end-user-messaging/pricing/
 * For the three countries the CSV splits by number type, the figure is the
 * message price plus the carrier fee on the route we would use (10DLC in the
 * US, long code in Canada, the international rate for India).
 *
 * Generated — do not edit. Refresh with \`pnpm --filter @retransmit/sms rates:refresh\`.
 */`;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
