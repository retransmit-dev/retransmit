/** Extracts the bare address from `"Name <user@example.com>"` or `user@example.com`. */
export function extractEmailAddress(value: string): string | null {
  const angled = /<([^<>]+)>\s*$/.exec(value.trim());
  const candidate = (angled ? angled[1] : value).trim();
  if (!candidate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null;
  return candidate;
}

/** Extracts the domain (lowercased) from an address or `Name <address>` string. */
export function extractEmailDomain(value: string): string | null {
  const address = extractEmailAddress(value);
  if (!address) return null;
  const at = address.lastIndexOf("@");
  return address.slice(at + 1).toLowerCase();
}

export const DOMAIN_NAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
