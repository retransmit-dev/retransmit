export type SuppressionReason = "bounce" | "complaint" | "manual" | "unsubscribe";
export type SuppressionEntry = { email: string; reason: SuppressionReason };

/**
 * Parses a suppression CSV: one address per line, or `email,reason` rows
 * (a header row is skipped). Unknown reasons import as manual.
 */
export function parseSuppressionCsv(text: string): SuppressionEntry[] {
  const entries: SuppressionEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line
      .split(/[,;\t]/)
      .map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const email = cells[0];
    if (!email || !email.includes("@")) continue; // skips headers and blanks
    const rawReason = (cells[1] ?? "").toLowerCase();
    const reason: SuppressionReason = rawReason.includes("bounce")
      ? "bounce"
      : rawReason.includes("complain") || rawReason.includes("spam")
        ? "complaint"
        : rawReason.includes("unsub")
          ? "unsubscribe"
          : "manual";
    entries.push({ email, reason });
  }
  return entries;
}

export function toCsv(
  rows: { email: string; reason: string; createdAt: string | Date }[],
): string {
  const lines = ["email,reason,created_at"];
  for (const row of rows) {
    lines.push(
      `${row.email},${row.reason},${new Date(row.createdAt).toISOString()}`,
    );
  }
  return lines.join("\n");
}

export function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
