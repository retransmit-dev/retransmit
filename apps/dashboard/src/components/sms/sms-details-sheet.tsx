"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { SmsStatusBadge } from "@/components/status-badges";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";

type SmsDetails = RouterOutputs["sms"]["get"];

export function SmsDetailsSheet({
  smsId,
  onClose,
}: {
  smsId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={smsId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-4 data-[side=right]:sm:max-w-xl"
      >
        <ErrorBoundary title="Could not load this message">
          {smsId !== null && <SmsDetailsBody smsId={smsId} />}
        </ErrorBoundary>
      </SheetContent>
    </Sheet>
  );
}

function SmsDetailsBody({ smsId }: { smsId: string }) {
  const details = useQuery(trpc.sms.get.queryOptions({ id: smsId }));
  const message = details.data;

  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle className="flex items-center gap-2">
          <span className="truncate">{message?.to.join(", ") ?? "SMS"}</span>
          {message && <SmsStatusBadge status={message.status} />}
        </SheetTitle>
        <SheetDescription>
          {message ? `Sent ${formatDateTime(message.createdAt)}` : null}
        </SheetDescription>
      </SheetHeader>

      {details.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : message ? (
        <div className="flex flex-col gap-4 text-sm">
          <SmsSummary message={message} />

          {message.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              {message.error}
            </p>
          )}

          <div>
            <h3 className="mb-2 font-medium">Message</h3>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 font-sans">
              {message.text}
            </pre>
          </div>

          <SmsEvents events={message.events} />
        </div>
      ) : null}
    </>
  );
}

function SmsSummary({ message }: { message: SmsDetails }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border p-3">
      <span className="text-muted-foreground">From</span>
      <span className="truncate">{message.from ?? "Provider default"}</span>
      <span className="text-muted-foreground">To</span>
      <span className="truncate">{message.to.join(", ")}</span>
      <span className="text-muted-foreground">Country</span>
      <span>{message.country ?? "Unknown"}</span>
      <span className="text-muted-foreground">Segments</span>
      <span>{message.segments}</span>
      <span className="text-muted-foreground">Provider</span>
      <span className="truncate">
        {message.providerName ?? "Not routed yet"}
        {message.requestedProvider && (
          <span className="text-muted-foreground text-xs">
            {" "}
            · requested {message.requestedProvider}
          </span>
        )}
      </span>
      {message.providerMessageId && (
        <>
          <span className="text-muted-foreground">Provider id</span>
          <span className="truncate font-mono text-xs">{message.providerMessageId}</span>
        </>
      )}
      {message.lastEventAt && (
        <>
          <span className="text-muted-foreground">Last event</span>
          <span>{formatDateTime(message.lastEventAt)}</span>
        </>
      )}
    </div>
  );
}

function SmsEvents({ events }: { events: SmsDetails["events"] }) {
  return (
    <div>
      <h3 className="mb-2 font-medium">Events</h3>
      <div className="flex flex-col">
        {events.length === 0 ? (
          <p className="text-muted-foreground">No events recorded yet.</p>
        ) : (
          events.map((event, index) => (
            <div key={event.id}>
              {index > 0 && <Separator className="my-2" />}
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs">{event.type}</code>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
              {event.data && Object.keys(event.data).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Details
                  </summary>
                  <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border p-2 text-xs">
                    {Object.entries(event.data)
                      .filter(([, value]) => value !== "" && value != null)
                      .map(([key, value]) => (
                        <Fragment key={key}>
                          <span className="text-muted-foreground">{key}</span>
                          <span className="wrap-break-word">
                            {typeof value === "string"
                              ? value
                              : JSON.stringify(value)}
                          </span>
                        </Fragment>
                      ))}
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
