import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/**
 * Phone parsing sits on Google's libphonenumber metadata, via
 * libphonenumber-js. It replaces the hand-kept dial code table this file used
 * to carry, which knew a prefix but nothing about the number behind it: a
 * Cameroon number a digit short (`+23796302624`) passed validation and was
 * only rejected by the carrier, and every `+1` was reported as US, so Canadian
 * destinations were mislabelled.
 *
 * The gate is `isValid()` (full national pattern), not `isPossible()` (length
 * alone). Length is not enough here: Cameroon's possible lengths are [8, 9]
 * because legacy 8-digit ranges still exist, so the very number that prompted
 * this passes `isPossible()`. Only the pattern check knows that a CM
 * subscriber number starts with 2 or 6.
 *
 * The cost of that strictness is that operators open new prefix ranges faster
 * than the metadata ships, and in that window a real handset is refused. Bump
 * libphonenumber-js when a destination country reports numbers being rejected;
 * that is the intended fix, not loosening this check.
 *
 * `min` metadata is enough — it agrees with `max` on validity and country for
 * every destination we route. `max` would additionally expose `getType()`, if
 * rejecting fixed lines before paying for a send is ever worth it.
 */

/**
 * Calling codes libphonenumber holds a numbering plan for. A number on one of
 * these has to satisfy that plan. Anything else is either an international
 * network with no single country (+882, +883) or an unassigned code, and the
 * first of those is still routable, so it is passed through for a provider
 * with `null` country support to judge.
 *
 * The check is on the calling code rather than on `country` because a number
 * too short to place — `+1518368972` — parses with calling code 1 and no
 * country, and must be rejected rather than treated as unrecognized.
 */
const KNOWN_CALLING_CODES = new Set(
  getCountries().map((country) => getCountryCallingCode(country)),
);

/**
 * Normalizes a phone number to E.164 (`+2376xxxxxxxx`). Accepts `+` or `00`
 * international prefixes and tolerates spaces, dots, dashes and parentheses.
 * Returns null for anything else — numbers must be in international format,
 * since routing depends on the country prefix — and for numbers that do not
 * fit their country's numbering plan.
 */
export function normalizePhone(value: string): string | null {
  let cleaned = value.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;

  const parsed = parsePhoneNumberFromString(cleaned);
  if (parsed?.isValid()) return parsed.number;

  const callingCode = parsed?.countryCallingCode;
  return callingCode && !KNOWN_CALLING_CODES.has(callingCode) ? cleaned : null;
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
