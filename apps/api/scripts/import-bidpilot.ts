/**
 * One-time import of bidpilot (Captivaq) outreach history into retransmit.
 * Delete this file once the migration has run against production.
 *
 * Reads the two CSV exports from bidpilot's admin outreach page:
 *   - leads:        one row per outreach email (sent_body, unsubscribe_token, ...)
 *   - suppressions: email,reason,created_at (reason UNSUBSCRIBED | MANUAL | ...)
 *
 * Sent leads become `email` rows (marketing, status mapped from the export)
 * with ids derived from their legacy unsubscribe token, so old
 * app.captivaq.com/unsubscribe/:token links forwarded to the retransmit API
 * keep working (see legacyEmailIdForToken). Suppression rows keep their
 * reason and timestamp; entries of the bare form `@example.com` are imported
 * verbatim and suppress the whole domain at send time.
 *
 * Idempotent: ids are deterministic and inserts are ON CONFLICT DO NOTHING,
 * so re-running only adds what is missing.
 *
 * Usage (local, from the repo root):
 *   pnpm import:bidpilot --user jpainam@gmail.com \
 *     --leads ~/Downloads/outreach-leads-2026-09-02.csv \
 *     --suppressions ~/Downloads/outreach-suppressions-2026-09-02.csv \
 *     [--from "Captivaq <contact@logestalabs.com>"] [--dry-run]
 *
 * Against the remote database, prefix the same command with the remote URL
 * (an already-set DATABASE_URL wins over the one in .env):
 *   DATABASE_URL=postgres://... pnpm import:bidpilot --user ... --leads ...
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { ensureOrganizationForUser } from "@retransmit/auth/organization";
import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { user } from "@retransmit/db/schema/auth";
import { email, emailEvent, suppression } from "@retransmit/db/schema/email";
import type { EmailStatus, SuppressionReason } from "@retransmit/db/schema/email";
import { DOMAIN_NAME_REGEX, extractEmailAddress } from "@retransmit/email/address";
import { legacyEmailIdForToken } from "@retransmit/email/unsubscribe";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

const INSERT_CHUNK = 500;

// ---------------------------------------------------------------------------
// CSV (RFC 4180: quoted fields, embedded commas/quotes/newlines)

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name.trim(), cells[index]?.trim() ?? ""])),
  );
}

// ---------------------------------------------------------------------------
// Mapping

const SUPPRESSION_REASON_MAP: Record<string, SuppressionReason> = {
  UNSUBSCRIBED: "unsubscribe",
  MANUAL: "manual",
  BOUNCED: "bounce",
  COMPLAINED: "complaint",
};

/**
 * Bare address lowercased, or a `@example.com` domain-wide entry kept
 * verbatim; null for anything else.
 */
function normalizeSuppressionEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("@")) {
    return DOMAIN_NAME_REGEX.test(trimmed.slice(1)) ? trimmed : null;
  }
  return extractEmailAddress(trimmed);
}

function mapLeadStatus(status: string): EmailStatus {
  switch (status) {
    case "SENT":
      return "sent";
    case "SUPPRESSED":
      return "suppressed";
    case "FAILED":
      return "failed";
    default:
      // QUEUED / SENDING / NEEDS_EMAIL: outreach moved platforms, nothing
      // will pick these up again.
      return "canceled";
  }
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Deterministic event id so re-imports do not duplicate events. */
function legacyEventId(token: string): string {
  return `evt_leg_${createHash("sha256").update(`evt:${token}`).digest("hex").slice(0, 32)}`;
}

// ---------------------------------------------------------------------------

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<number>) {
  let added = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    added += await insert(rows.slice(i, i + INSERT_CHUNK));
  }
  return added;
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      user: { type: "string" },
      leads: { type: "string" },
      suppressions: { type: "string" },
      from: { type: "string", default: "Captivaq <contact@logestalabs.com>" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!args.user || (!args.leads && !args.suppressions)) {
    console.error(
      "Usage: import-bidpilot --user <account email> [--leads <csv>] [--suppressions <csv>] [--from <sender>] [--dry-run]",
    );
    process.exit(1);
  }
  const dryRun = args["dry-run"];

  const [account] = await db.select().from(user).where(eq(user.email, args.user));
  if (!account) throw new Error(`No user with email ${args.user} in this database`);
  const organization = await ensureOrganizationForUser(account.id);
  console.log(
    `Importing into organization ${organization.id} (user ${account.email})${dryRun ? " [dry run]" : ""}`,
  );

  // Leads first: suppression rows link back to the email they unsubscribed from.
  const emailIdByAddress = new Map<string, string>();
  if (args.leads) {
    const leads = parseCsv(readFileSync(args.leads, "utf8"));
    const emailRows: (typeof email.$inferInsert)[] = [];
    const eventRows: (typeof emailEvent.$inferInsert)[] = [];
    let skipped = 0;

    for (const lead of leads) {
      const address = extractEmailAddress(lead.business_email ?? "");
      if (!address) {
        skipped++;
        console.warn(`  skipping lead ${lead.lead_id}: invalid email "${lead.business_email}"`);
        continue;
      }
      const token = lead.unsubscribe_token ?? "";
      const id = legacyEmailIdForToken(token) ?? createId("em");
      const createdAt = parseDate(lead.created_at) ?? new Date();
      const sentAt = parseDate(lead.sent_at);
      const status = mapLeadStatus(lead.status ?? "");

      emailIdByAddress.set(address.toLowerCase(), id);
      emailRows.push({
        id,
        userId: account.id,
        organizationId: organization.id,
        from: args.from,
        to: [address],
        subject: lead.sent_subject || "(bidpilot outreach, not sent)",
        text: lead.sent_body || null,
        marketing: true,
        providerMessageId: lead.message_id || null,
        status,
        error: lead.error || null,
        lastEventAt: sentAt,
        createdAt,
      });
      if (status === "sent" && token) {
        eventRows.push({
          id: legacyEventId(token),
          emailId: id,
          type: "email.sent",
          // Lead facts that have no column in retransmit ride along on the
          // event so nothing from the export is lost.
          data: {
            imported: "bidpilot",
            leadId: lead.lead_id,
            companyName: lead.company_name,
            website: lead.website,
            phone: lead.phone,
            city: lead.city,
            state: lead.state,
            industry: lead.industry,
            naicsCodes: lead.naics_codes,
            uei: lead.uei,
            segment: lead.segment,
            sourceUrl: lead.source_url,
            personalizationFact: lead.personalization_fact,
            notes: lead.notes,
          },
          createdAt: sentAt ?? createdAt,
        });
      }
    }

    console.log(`Leads: ${emailRows.length} to import, ${skipped} skipped`);
    if (!dryRun) {
      const added = await insertChunked(emailRows, async (chunk) => {
        const inserted = await db
          .insert(email)
          .values(chunk)
          .onConflictDoNothing({ target: email.id })
          .returning({ id: email.id });
        return inserted.length;
      });
      const events = await insertChunked(eventRows, async (chunk) => {
        const inserted = await db
          .insert(emailEvent)
          .values(chunk)
          .onConflictDoNothing({ target: emailEvent.id })
          .returning({ id: emailEvent.id });
        return inserted.length;
      });
      console.log(`  inserted ${added} emails (${emailRows.length - added} already present), ${events} sent events`);
    }
  }

  if (args.suppressions) {
    const entries = parseCsv(readFileSync(args.suppressions, "utf8"));
    const rows: (typeof suppression.$inferInsert)[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const entry of entries) {
      const address = normalizeSuppressionEmail(entry.email ?? "");
      if (!address || seen.has(address)) {
        skipped++;
        if (!address) console.warn(`  skipping suppression: invalid entry "${entry.email}"`);
        continue;
      }
      seen.add(address);
      const reason = SUPPRESSION_REASON_MAP[entry.reason?.toUpperCase() ?? ""] ?? "manual";
      rows.push({
        id: createId("sup"),
        organizationId: organization.id,
        email: address,
        reason,
        createdByUserId: account.id,
        sourceEmailId: reason === "unsubscribe" ? emailIdByAddress.get(address) : undefined,
        createdAt: parseDate(entry.created_at) ?? new Date(),
      });
    }

    console.log(`Suppressions: ${rows.length} to import, ${skipped} skipped/duplicate`);
    if (!dryRun) {
      const added = await insertChunked(rows, async (chunk) => {
        const inserted = await db
          .insert(suppression)
          .values(chunk)
          .onConflictDoNothing({ target: [suppression.organizationId, suppression.email] })
          .returning({ id: suppression.id });
        return inserted.length;
      });
      console.log(`  inserted ${added} (${rows.length - added} already on the list)`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
