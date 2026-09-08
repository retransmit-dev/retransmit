import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Phone parsing sits on Google's libphonenumber metadata, via
 * libphonenumber-js. It replaces a hand-kept dial code table that knew a
 * prefix but nothing about the number behind it: a Cameroon number a digit
 * short (`+23796302624`) passed and was only rejected by the carrier, and
 * every `+1` was reported as US, so Canada was mislabelled.
 *
 * The gate is `isValid()` (full national pattern) rather than `isPossible()`
 * (length alone). Length is not enough: Cameroon's possible lengths are [8, 9]
 * because legacy 8-digit ranges still exist, so the number that prompted this
 * passes `isPossible()`. If a country ever reports real numbers being refused,
 * bump libphonenumber-js — that is the fix, not loosening the check.
 */

/**
 * Normalizes a phone number to E.164 (`+2376xxxxxxxx`). Accepts `+` or `00`
 * international prefixes and tolerates spaces, dots, dashes and parentheses.
 * Returns null for anything else — numbers must be in international format,
 * since routing depends on the country — and for numbers that do not fit
 * their country's numbering plan.
 */
export function normalizePhone(value: string): string | null {
  let cleaned = value.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  const parsed = parsePhoneNumberFromString(cleaned);
  return parsed?.isValid() ? parsed.number : null;
}

/** ISO country for a normalized E.164 number, or null when unrecognized. */
export function detectCountry(e164: string): string | null {
  return parsePhoneNumberFromString(e164)?.country ?? null;
}

const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM7_EXTENSION = new Set("^{}\\[~]|€");

/**
 * Billable parts for a message: GSM-7 texts split at 160 chars (153 per part
 * when concatenated), anything needing UCS-2 splits at 70 (67 per part).
 */
export function smsSegments(text: string): number {
  let septets = 0;
  for (const char of text) {
    if (GSM7.has(char)) septets += 1;
    else if (GSM7_EXTENSION.has(char)) septets += 2;
    else {
      const units = text.length; // UTF-16 code units, which is what UCS-2 counts
      return units <= 70 ? 1 : Math.ceil(units / 67);
    }
  }
  return septets <= 160 ? 1 : Math.ceil(septets / 153);
}
