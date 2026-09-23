import { db } from "@retransmit/db";
import {
  sms,
  smsConsent,
  smsSender,
  smsSuppression,
} from "@retransmit/db/schema/sms";
import type { SmsPurpose } from "@retransmit/db/schema/sms";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";

/**
 * Hosted SMS launches with a deliberately narrow footprint. Cameroon is the
 * only destination until another country has its own reviewed program and AWS
 * protection rule. Operators may narrow this further, but an empty value does
 * not accidentally turn the world on.
 */
export function allowedSmsCountries(): Set<string> {
  const raw = process.env.SMS_ALLOWED_COUNTRIES ?? "CM";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
}

export type SmsComplianceCode =
  | "sms_country_not_allowed"
  | "sms_program_required"
  | "sms_purpose_not_allowed"
  | "sms_consent_required"
  | "sms_recipient_suppressed"
  | "sms_rate_limit"
  | "sms_quiet_hours";

export interface SmsComplianceFailure {
  code: SmsComplianceCode;
  message: string;
}

export type ApprovedSmsProgram = typeof smsSender.$inferSelect;

export function formatProgramMessage(program: ApprovedSmsProgram, body: string): string {
  const trimmed = body.trim();
  const branded = trimmed.toLowerCase().startsWith(`${program.senderId.toLowerCase()}:`)
    ? trimmed
    : `${program.senderId}: ${trimmed}`;
  const footer = [program.optOutText, program.supportEmail ? `Help: ${program.supportEmail}` : null]
    .filter(Boolean)
    .join(" ");
  return footer && !branded.toLowerCase().includes(footer.toLowerCase())
    ? `${branded}\n${footer}`
    : branded;
}

function hourInCameroon(now: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Douala",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

/** OTP and security alerts may be requested or needed at any hour. */
function isQuietHour(purpose: SmsPurpose, now: Date): boolean {
  if (purpose === "otp" || purpose === "security") return false;
  const hour = hourInCameroon(now);
  return hour < 8 || hour >= 20;
}

async function sentRecipientCount(
  organizationId: string,
  smsSenderId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(jsonb_array_length(${sms.to})), 0)::int`,
    })
    .from(sms)
    .where(
      and(
        eq(sms.organizationId, organizationId),
        eq(sms.smsSenderId, smsSenderId),
        gte(sms.createdAt, since),
      ),
    );
  return Number(row?.total ?? 0);
}

async function perRecipientCounts(
  organizationId: string,
  smsSenderId: string,
  recipients: string[],
  since: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ to: sms.to })
    .from(sms)
    .where(
      and(
        eq(sms.organizationId, organizationId),
        eq(sms.smsSenderId, smsSenderId),
        gte(sms.createdAt, since),
      ),
    );
  const wanted = new Set(recipients);
  const counts = new Map(recipients.map((phone) => [phone, 0]));
  for (const row of rows) {
    for (const phone of row.to) {
      if (wanted.has(phone)) counts.set(phone, (counts.get(phone) ?? 0) + 1);
    }
  }
  return counts;
}

export async function checkSmsCompliance(input: {
  organizationId: string;
  program: ApprovedSmsProgram;
  recipients: string[];
  purpose: SmsPurpose;
  country: string | null;
  now?: Date;
  checkVolume?: boolean;
  checkTiming?: boolean;
}): Promise<SmsComplianceFailure | null> {
  const now = input.now ?? new Date();
  const { organizationId, program, recipients, purpose, country } = input;

  if (!country || !allowedSmsCountries().has(country)) {
    return {
      code: "sms_country_not_allowed",
      message: `SMS production access is currently limited to ${[...allowedSmsCountries()].join(", ")}`,
    };
  }
  if (program.status !== "approved" || !program.countries.includes(country)) {
    return { code: "sms_program_required", message: "This SMS program is not approved for the destination" };
  }
  if (!program.purposes.includes(purpose)) {
    return {
      code: "sms_purpose_not_allowed",
      message: `The ${purpose} purpose is not approved for ${program.senderId}`,
    };
  }
  if (input.checkTiming !== false && isQuietHour(purpose, now)) {
    return {
      code: "sms_quiet_hours",
      message: "Non-urgent SMS may only be queued from 08:00 to 20:00 Africa/Douala time",
    };
  }

  const suppressed = await db
    .select({ phone: smsSuppression.phone })
    .from(smsSuppression)
    .where(
      and(
        eq(smsSuppression.organizationId, organizationId),
        inArray(smsSuppression.phone, recipients),
      ),
    );
  if (suppressed.length > 0) {
    return {
      code: "sms_recipient_suppressed",
      message: `${suppressed[0]!.phone} has opted out or is suppressed`,
    };
  }

  const consents = await db
    .select({ phone: smsConsent.phone, purposes: smsConsent.purposes })
    .from(smsConsent)
    .where(
      and(
        eq(smsConsent.organizationId, organizationId),
        eq(smsConsent.smsSenderId, program.id),
        inArray(smsConsent.phone, recipients),
        isNull(smsConsent.optedOutAt),
      ),
    );
  const consentByPhone = new Map(consents.map((row) => [row.phone, row.purposes]));
  const missing = recipients.find((phone) => !consentByPhone.get(phone)?.includes(purpose));
  if (missing) {
    return {
      code: "sms_consent_required",
      message: `No active ${purpose} SMS consent is recorded for ${missing}`,
    };
  }

  if (input.checkVolume === false) return null;
  if (!program.dailyLimit || !program.monthlyLimit || !program.recipientDailyLimit) {
    return { code: "sms_program_required", message: "This SMS program has no approved sending limits" };
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [daily, monthly, recipientCounts] = await Promise.all([
    sentRecipientCount(organizationId, program.id, dayAgo),
    sentRecipientCount(organizationId, program.id, monthAgo),
    perRecipientCounts(organizationId, program.id, recipients, dayAgo),
  ]);
  if (daily + recipients.length > program.dailyLimit) {
    return { code: "sms_rate_limit", message: `The approved daily limit of ${program.dailyLimit} recipients has been reached` };
  }
  if (monthly + recipients.length > program.monthlyLimit) {
    return { code: "sms_rate_limit", message: `The approved monthly limit of ${program.monthlyLimit} recipients has been reached` };
  }
  const overRecipient = recipients.find(
    (phone) => (recipientCounts.get(phone) ?? 0) + 1 > program.recipientDailyLimit!,
  );
  if (overRecipient) {
    return {
      code: "sms_rate_limit",
      message: `${overRecipient} reached the approved limit of ${program.recipientDailyLimit} messages in 24 hours`,
    };
  }
  return null;
}

export async function approvedProgramById(id: string): Promise<ApprovedSmsProgram | null> {
  const [program] = await db.select().from(smsSender).where(eq(smsSender.id, id));
  return program?.status === "approved" ? program : null;
}
