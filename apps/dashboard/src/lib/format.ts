/** "Sep 3, 02:15 PM" — for timestamps in tables and sheets. */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The viewer's short date, for "added on" columns. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString();
}

/** "1.2 MB" / "340 KB" / "12 B" for attachment sizes. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
