import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Mirrors EMAIL_STATUSES in @retransmit/db (kept local so the schema
 * package stays out of the client bundle). */
export const EMAIL_STATUS_OPTIONS = [
  { value: "queued", label: "Queued", dot: "bg-slate-400" },
  { value: "scheduled", label: "Scheduled", dot: "bg-sky-400" },
  { value: "sent", label: "Sent", dot: "bg-blue-500" },
  { value: "delivery_delayed", label: "Delivery delayed", dot: "bg-amber-500" },
  { value: "delivered", label: "Delivered", dot: "bg-emerald-500" },
  { value: "opened", label: "Opened", dot: "bg-teal-500" },
  { value: "clicked", label: "Clicked", dot: "bg-cyan-500" },
  { value: "bounced", label: "Bounced", dot: "bg-red-500" },
  { value: "complained", label: "Complained", dot: "bg-rose-600" },
  { value: "suppressed", label: "Suppressed", dot: "bg-zinc-500" },
  { value: "canceled", label: "Canceled", dot: "bg-zinc-400" },
  { value: "rejected", label: "Rejected", dot: "bg-orange-600" },
  { value: "failed", label: "Failed", dot: "bg-red-600" },
] as const;

export type EmailStatusValue = (typeof EMAIL_STATUS_OPTIONS)[number]["value"];

const EMAIL_STATUS_BY_VALUE = new Map(
  EMAIL_STATUS_OPTIONS.map((option) => [option.value as string, option]),
);

export function EmailStatusBadge({ status }: { status: string }) {
  const option = EMAIL_STATUS_BY_VALUE.get(status);
  return (
    <Badge variant="outline">
      <span
        className={cn("size-1.5 rounded-full", option?.dot ?? "bg-muted-foreground")}
      />
      {option?.label ?? status}
    </Badge>
  );
}

const DOMAIN_STATUS: Record<string, { label: string; dot: string }> = {
  verified: { label: "Verified", dot: "bg-emerald-500" },
  pending: { label: "Pending", dot: "bg-amber-500" },
  failed: { label: "Failed", dot: "bg-red-500" },
  temporary_failure: { label: "Temporary failure", dot: "bg-orange-500" },
};

export function DomainStatusBadge({ status }: { status: string }) {
  const option = DOMAIN_STATUS[status];
  return (
    <Badge variant="outline">
      <span
        className={cn("size-1.5 rounded-full", option?.dot ?? "bg-muted-foreground")}
      />
      {option?.label ?? status}
    </Badge>
  );
}

const WHATSAPP_ACCOUNT_STATUS: Record<string, { label: string; dot: string }> = {
  active: { label: "Connected", dot: "bg-emerald-500" },
  pending: { label: "Pending registration", dot: "bg-amber-500" },
  disconnected: { label: "Disconnected", dot: "bg-zinc-500" },
};

export function WhatsappAccountStatusBadge({ status }: { status: string }) {
  const option = WHATSAPP_ACCOUNT_STATUS[status];
  return (
    <Badge variant="outline">
      <span
        className={cn("size-1.5 rounded-full", option?.dot ?? "bg-muted-foreground")}
      />
      {option?.label ?? status}
    </Badge>
  );
}

const SUPPRESSION_REASON: Record<string, { label: string; dot: string }> = {
  bounce: { label: "Bounced", dot: "bg-red-500" },
  complaint: { label: "Complained", dot: "bg-amber-500" },
  manual: { label: "Manual", dot: "bg-zinc-400" },
  unsubscribe: { label: "Unsubscribed", dot: "bg-sky-500" },
};

export function SuppressionReasonBadge({ reason }: { reason: string }) {
  const option = SUPPRESSION_REASON[reason];
  return (
    <Badge variant="outline">
      <span
        className={cn("size-1.5 rounded-full", option?.dot ?? "bg-muted-foreground")}
      />
      {option?.label ?? reason}
    </Badge>
  );
}
