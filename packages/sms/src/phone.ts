/**
 * Dial code → ISO 3166-1 alpha-2 country. Longest-prefix match wins, so the
 * order here does not matter. Extend freely when new destinations come up;
 * a number whose prefix is missing still sends if a provider with `null`
 * country support (a global aggregator like Twilio) is configured.
 */
const DIAL_CODES: Record<string, string> = {
  // Africa (complete for the MTN opco footprint + neighbors)
  "20": "EG",
  "212": "MA",
  "213": "DZ",
  "216": "TN",
  "218": "LY",
  "220": "GM",
  "221": "SN",
  "222": "MR",
  "223": "ML",
  "224": "GN",
  "225": "CI",
  "226": "BF",
  "227": "NE",
  "228": "TG",
  "229": "BJ",
  "230": "MU",
  "231": "LR",
  "232": "SL",
  "233": "GH",
  "234": "NG",
  "235": "TD",
  "236": "CF",
  "237": "CM",
  "238": "CV",
  "239": "ST",
  "240": "GQ",
  "241": "GA",
  "242": "CG",
  "243": "CD",
  "244": "AO",
  "245": "GW",
  "248": "SC",
  "249": "SD",
  "250": "RW",
  "251": "ET",
  "252": "SO",
  "253": "DJ",
  "254": "KE",
  "255": "TZ",
  "256": "UG",
  "257": "BI",
  "258": "MZ",
  "260": "ZM",
  "261": "MG",
  "263": "ZW",
  "264": "NA",
  "265": "MW",
  "266": "LS",
  "267": "BW",
  "268": "SZ",
  "269": "KM",
  "27": "ZA",
  "291": "ER",
  // Common non-African destinations
  "1": "US",
  "30": "GR",
  "31": "NL",
  "32": "BE",
  "33": "FR",
  "34": "ES",
  "351": "PT",
  "352": "LU",
  "353": "IE",
  "39": "IT",
  "40": "RO",
  "41": "CH",
  "43": "AT",
  "44": "GB",
  "45": "DK",
  "46": "SE",
  "47": "NO",
  "48": "PL",
  "49": "DE",
  "52": "MX",
  "55": "BR",
  "61": "AU",
  "62": "ID",
  "63": "PH",
  "65": "SG",
  "81": "JP",
  "82": "KR",
  "84": "VN",
  "86": "CN",
  "90": "TR",
  "91": "IN",
  "92": "PK",
  "966": "SA",
  "971": "AE",
  "972": "IL",
  "974": "QA",
};

const MAX_DIAL_CODE_LENGTH = 3;

/**
 * Normalizes a phone number to E.164 (`+2376xxxxxxxx`). Accepts `+` or `00`
 * international prefixes and tolerates spaces, dots, dashes and parentheses.
 * Returns null for anything else — numbers must be in international format,
 * since routing depends on the country prefix.
 */
export function normalizePhone(value: string): string | null {
  let cleaned = value.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
  if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) return null;
  return cleaned;
}

/** ISO country for a normalized E.164 number, or null when unrecognized. */
export function detectCountry(e164: string): string | null {
  const digits = e164.replace(/^\+/, "");
  for (let length = MAX_DIAL_CODE_LENGTH; length >= 1; length--) {
    const country = DIAL_CODES[digits.slice(0, length)];
    if (country) return country;
  }
  return null;
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
