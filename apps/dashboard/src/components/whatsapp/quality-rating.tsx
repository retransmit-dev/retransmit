const QUALITY: Record<string, { label: string; className: string }> = {
  GREEN: { label: "High", className: "text-emerald-600" },
  YELLOW: { label: "Medium", className: "text-amber-600" },
  RED: { label: "Low", className: "text-red-600" },
};

/** Meta's traffic-light quality rating as a word. */
export function QualityRating({ rating }: { rating: string | null }) {
  const option = rating ? QUALITY[rating.toUpperCase()] : undefined;
  if (!option) return <span className="text-muted-foreground">Unknown</span>;
  return <span className={option.className}>{option.label}</span>;
}
