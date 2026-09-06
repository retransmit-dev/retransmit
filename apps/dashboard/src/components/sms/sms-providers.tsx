"use client";

import { StatusDot } from "@/components/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Which upstream providers this deployment can route through. Routing itself
 * is server-side and per destination; this row only explains an unroutable
 * country or a message that went out through an unexpected carrier.
 */
export function SmsProviders() {
  const providers = useQuery(trpc.sms.providers.queryOptions());
  const rows = providers.data ?? [];
  const configured = rows.filter((provider) => provider.configured);

  if (providers.isSuccess && configured.length === 0) {
    return (
      <Alert>
        <AlertTitle>No SMS provider is configured</AlertTitle>
        <AlertDescription>
          Set SNS_SMS_REGION for Amazon SNS, or the MTN_CM_* or ORANGE_CM_*
          credentials, on the API server. Sends fail with no_route until then.
        </AlertDescription>
      </Alert>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Providers</span>
      {rows.map((provider) => (
        <Badge
          key={provider.key}
          variant="outline"
          title={
            provider.configured
              ? provider.global
                ? "Configured, delivers anywhere"
                : "Configured"
              : "Not configured on this deployment"
          }
        >
          <StatusDot
            className={provider.configured ? "bg-emerald-500" : "bg-zinc-400"}
          />
          {provider.name}
          {provider.global && provider.configured ? " · global" : ""}
        </Badge>
      ))}
    </div>
  );
}
