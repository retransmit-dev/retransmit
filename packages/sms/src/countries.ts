/**
 * Destinations a customer can request a sender id for, and what each country
 * expects as an origination identity.
 *
 * Kept free of AWS SDK imports so the dashboard can be served this list as-is
 * (same reason as packages/email/src/regions.ts). The ISO codes match what
 * `detectCountry` in phone.ts returns, so a country shown here is a country a
 * send can actually be routed for.
 *
 * `senderId` is the part that decides which flow the dashboard shows:
 * - `dynamic`     — an alphanumeric sender id passes without pre-registration.
 *                   We still record it so sends are consistent and spoofing is
 *                   blocked on our side.
 * - `registration` — carriers require the sender id to be registered before it
 *                   delivers. Retransmit files the registration; approval is
 *                   days to weeks, which is why the request has a status.
 * - `unsupported` — the country does not accept alphanumeric sender ids at all
 *                   and needs a number instead (10DLC, toll-free or short
 *                   code). Retransmit provisions those; a customer never brings
 *                   their own number. Not offered yet, so these are shown
 *                   disabled with the reason.
 *
 * The table is deliberately conservative: `registration` is the default for
 * anything not known to accept unregistered ids, because filing a registration
 * that turns out to be unnecessary costs a few days, while assuming `dynamic`
 * where it is wrong means messages silently do not arrive.
 */
export type SenderIdSupport = "dynamic" | "registration" | "unsupported";

export interface SmsCountry {
  /** ISO 3166-1 alpha-2, as returned by `detectCountry`. */
  code: string;
  name: string;
  flag: string;
  /** E.164 country calling code, without the `+`. */
  dialCode: string;
  senderId: SenderIdSupport;
}

/**
 * Countries with a dial code in phone.ts, in the order the dashboard shows
 * them: the operating footprint first, then the rest alphabetically.
 */
export const SMS_COUNTRIES: readonly SmsCountry[] = [
  // -- Central and West Africa: the launch footprint -----------------------
  { code: "CM", name: "Cameroon", flag: "🇨🇲", dialCode: "237", senderId: "dynamic" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dialCode: "225", senderId: "dynamic" },
  { code: "SN", name: "Senegal", flag: "🇸🇳", dialCode: "221", senderId: "dynamic" },
  { code: "GA", name: "Gabon", flag: "🇬🇦", dialCode: "241", senderId: "dynamic" },
  { code: "CG", name: "Congo", flag: "🇨🇬", dialCode: "242", senderId: "dynamic" },
  { code: "CD", name: "DR Congo", flag: "🇨🇩", dialCode: "243", senderId: "dynamic" },
  { code: "TD", name: "Chad", flag: "🇹🇩", dialCode: "235", senderId: "dynamic" },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫", dialCode: "236", senderId: "dynamic" },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶", dialCode: "240", senderId: "dynamic" },
  { code: "BJ", name: "Benin", flag: "🇧🇯", dialCode: "229", senderId: "dynamic" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", dialCode: "226", senderId: "dynamic" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dialCode: "233", senderId: "registration" },
  { code: "GN", name: "Guinea", flag: "🇬🇳", dialCode: "224", senderId: "dynamic" },
  { code: "GM", name: "Gambia", flag: "🇬🇲", dialCode: "220", senderId: "dynamic" },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼", dialCode: "245", senderId: "dynamic" },
  { code: "LR", name: "Liberia", flag: "🇱🇷", dialCode: "231", senderId: "dynamic" },
  { code: "ML", name: "Mali", flag: "🇲🇱", dialCode: "223", senderId: "dynamic" },
  { code: "MR", name: "Mauritania", flag: "🇲🇷", dialCode: "222", senderId: "dynamic" },
  { code: "NE", name: "Niger", flag: "🇳🇪", dialCode: "227", senderId: "dynamic" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dialCode: "234", senderId: "registration" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱", dialCode: "232", senderId: "dynamic" },
  { code: "ST", name: "São Tomé and Príncipe", flag: "🇸🇹", dialCode: "239", senderId: "dynamic" },
  { code: "TG", name: "Togo", flag: "🇹🇬", dialCode: "228", senderId: "dynamic" },
  { code: "CV", name: "Cabo Verde", flag: "🇨🇻", dialCode: "238", senderId: "dynamic" },

  // -- Rest of Africa ------------------------------------------------------
  { code: "AO", name: "Angola", flag: "🇦🇴", dialCode: "244", senderId: "dynamic" },
  { code: "BI", name: "Burundi", flag: "🇧🇮", dialCode: "257", senderId: "dynamic" },
  { code: "BW", name: "Botswana", flag: "🇧🇼", dialCode: "267", senderId: "dynamic" },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯", dialCode: "253", senderId: "dynamic" },
  { code: "DZ", name: "Algeria", flag: "🇩🇿", dialCode: "213", senderId: "registration" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", dialCode: "20", senderId: "registration" },
  { code: "ER", name: "Eritrea", flag: "🇪🇷", dialCode: "291", senderId: "dynamic" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", dialCode: "251", senderId: "registration" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dialCode: "254", senderId: "registration" },
  { code: "KM", name: "Comoros", flag: "🇰🇲", dialCode: "269", senderId: "dynamic" },
  { code: "LS", name: "Lesotho", flag: "🇱🇸", dialCode: "266", senderId: "dynamic" },
  { code: "LY", name: "Libya", flag: "🇱🇾", dialCode: "218", senderId: "dynamic" },
  { code: "MA", name: "Morocco", flag: "🇲🇦", dialCode: "212", senderId: "registration" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬", dialCode: "261", senderId: "dynamic" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺", dialCode: "230", senderId: "dynamic" },
  { code: "MW", name: "Malawi", flag: "🇲🇼", dialCode: "265", senderId: "dynamic" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿", dialCode: "258", senderId: "dynamic" },
  { code: "NA", name: "Namibia", flag: "🇳🇦", dialCode: "264", senderId: "dynamic" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", dialCode: "250", senderId: "registration" },
  { code: "SC", name: "Seychelles", flag: "🇸🇨", dialCode: "248", senderId: "dynamic" },
  { code: "SD", name: "Sudan", flag: "🇸🇩", dialCode: "249", senderId: "dynamic" },
  { code: "SO", name: "Somalia", flag: "🇸🇴", dialCode: "252", senderId: "dynamic" },
  { code: "SZ", name: "Eswatini", flag: "🇸🇿", dialCode: "268", senderId: "dynamic" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳", dialCode: "216", senderId: "registration" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", dialCode: "255", senderId: "registration" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", dialCode: "256", senderId: "registration" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", dialCode: "27", senderId: "dynamic" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲", dialCode: "260", senderId: "dynamic" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", dialCode: "263", senderId: "dynamic" },

  // -- Europe --------------------------------------------------------------
  { code: "AT", name: "Austria", flag: "🇦🇹", dialCode: "43", senderId: "dynamic" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", dialCode: "32", senderId: "dynamic" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", dialCode: "41", senderId: "dynamic" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "49", senderId: "dynamic" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", dialCode: "45", senderId: "dynamic" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dialCode: "34", senderId: "registration" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "33", senderId: "dynamic" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "44", senderId: "dynamic" },
  { code: "GR", name: "Greece", flag: "🇬🇷", dialCode: "30", senderId: "dynamic" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", dialCode: "353", senderId: "dynamic" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dialCode: "39", senderId: "registration" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", dialCode: "352", senderId: "dynamic" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dialCode: "31", senderId: "dynamic" },
  { code: "NO", name: "Norway", flag: "🇳🇴", dialCode: "47", senderId: "dynamic" },
  { code: "PL", name: "Poland", flag: "🇵🇱", dialCode: "48", senderId: "registration" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dialCode: "351", senderId: "dynamic" },
  { code: "RO", name: "Romania", flag: "🇷🇴", dialCode: "40", senderId: "dynamic" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", dialCode: "46", senderId: "dynamic" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷", dialCode: "90", senderId: "registration" },

  // -- Middle East ---------------------------------------------------------
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dialCode: "971", senderId: "registration" },
  { code: "IL", name: "Israel", flag: "🇮🇱", dialCode: "972", senderId: "registration" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", dialCode: "974", senderId: "registration" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dialCode: "966", senderId: "registration" },

  // -- Asia Pacific --------------------------------------------------------
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "61", senderId: "dynamic" },
  { code: "CN", name: "China", flag: "🇨🇳", dialCode: "86", senderId: "registration" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", dialCode: "62", senderId: "registration" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "91", senderId: "registration" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dialCode: "81", senderId: "registration" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", dialCode: "82", senderId: "registration" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", dialCode: "63", senderId: "registration" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", dialCode: "92", senderId: "registration" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "65", senderId: "registration" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", dialCode: "84", senderId: "registration" },

  // -- Americas: alphanumeric sender ids are not accepted ------------------
  { code: "BR", name: "Brazil", flag: "🇧🇷", dialCode: "55", senderId: "registration" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "1", senderId: "unsupported" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", dialCode: "52", senderId: "unsupported" },
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "1", senderId: "unsupported" },
] as const;

const BY_CODE = new Map(SMS_COUNTRIES.map((country) => [country.code, country]));

export function findCountry(code: string): SmsCountry | undefined {
  return BY_CODE.get(code.toUpperCase());
}

/** Country name for display, falling back to the raw code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown";
  return BY_CODE.get(code.toUpperCase())?.name ?? code.toUpperCase();
}

/** ISO codes a sender id request may target: everything but `unsupported`. */
export const SENDER_ID_COUNTRY_CODES = SMS_COUNTRIES.filter(
  (country) => country.senderId !== "unsupported",
).map((country) => country.code) as [string, ...string[]];

export function supportsSenderId(code: string): boolean {
  return findCountry(code)?.senderId !== "unsupported";
}

/**
 * Why a country cannot take an alphanumeric sender id. Shown next to the
 * disabled option so the answer is on screen rather than in a support thread.
 */
export const UNSUPPORTED_REASON =
  "Carriers here do not accept alphanumeric sender ids. Sending needs a number (10DLC, toll-free or short code), which Retransmit provisions — not available yet.";
