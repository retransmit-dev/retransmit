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
