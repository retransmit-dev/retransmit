"use client";

import { CopyButton } from "@/components/copy-button";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { WebhookEndpointStatusBadge } from "@/components/status-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CreatedSecretDialog } from "./created-secret-dialog";
import type { RevealedSecret } from "./created-secret-dialog";
import { DeleteEndpointDialog } from "./delete-endpoint-dialog";
import { DeliveryLog } from "./delivery-log";
import { EventTypePicker } from "./event-type-picker";
import type { WebhookEventValue } from "./event-types";

/** One endpoint: a settings row, the event checklist, the delivery log. */
export function EndpointDetailsView({ endpointId }: { endpointId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const details = useQuery(trpc.webhook.get.queryOptions({ id: endpointId }));
  const endpoint = details.data;
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);

  // null means "untouched": the picker shows what the server has.
  const [draftEvents, setDraftEvents] = useState<WebhookEventValue[] | null>(null);
  const events = draftEvents ?? endpoint?.eventTypes ?? [];
  const eventsChanged =
    draftEvents !== null &&
    endpoint !== undefined &&
    (draftEvents.length !== endpoint.eventTypes.length ||
      draftEvents.some((event) => !endpoint.eventTypes.includes(event)));

  const updateMutation = useMutation(
    trpc.webhook.update.mutationOptions({
      onSuccess: (updated, variables) => {
        void queryClient.invalidateQueries(trpc.webhook.pathFilter());
        if (variables.eventTypes) {
          setDraftEvents(null);
          toast.success("Events saved");
        } else if (variables.enabled !== undefined) {
          toast.success(updated.enabled ? "Endpoint enabled" : "Endpoint paused");
        }
      },
    }),
  );

  const rotateMutation = useMutation(
    trpc.webhook.rotateSecret.mutationOptions({
      onSuccess: (rotated) => {
        setRevealed({ id: rotated.id, url: rotated.url, secret: rotated.secret, reason: "rotated" });
      },
    }),
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{endpoint?.url ?? "Endpoint"}</span>
            {endpoint && <WebhookEndpointStatusBadge enabled={endpoint.enabled} />}
          </span>
        }
        description={endpoint ? `Added ${formatDateTime(endpoint.createdAt)}` : undefined}
        actions={
          <Button variant="ghost" nativeButton={false} render={<Link href="/webhooks" />}>
            <ArrowLeftIcon />
            Webhooks
          </Button>
        }
      />

      {details.isLoading ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : endpoint ? (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Switch
                id="webhook-enabled"
                checked={endpoint.enabled}
                disabled={updateMutation.isPending}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ id: endpoint.id, enabled: checked })
                }
              />
              <Label htmlFor="webhook-enabled" className="font-normal">
                {endpoint.enabled ? "Enabled" : "Paused"}
              </Label>
            </div>

            <div className="flex items-center gap-1">
              <code className="font-mono text-xs text-muted-foreground">{endpoint.id}</code>
              <CopyButton
                value={endpoint.id}
                label="Copy endpoint ID"
                toastMessage="Endpoint ID copied"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="outline" size="sm" />}
                  disabled={rotateMutation.isPending}
                >
                  {rotateMutation.isPending ? <Spinner /> : <KeyRoundIcon />}
                  Rotate secret
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rotate the signing secret?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The current secret stops working right away.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => rotateMutation.mutate({ id: endpoint.id })}>
                      Rotate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <DeleteEndpointDialog
                endpoint={endpoint}
                labelled
                onDeleted={() => router.push("/webhooks")}
              />
            </div>
          </div>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex h-8 items-center justify-between gap-3">
              <h2 className="font-medium">Events</h2>
              {eventsChanged && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraftEvents(null)}
                    disabled={updateMutation.isPending}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: endpoint.id, eventTypes: events })}
                    disabled={updateMutation.isPending || events.length === 0}
                  >
                    {updateMutation.isPending && <Spinner />}
                    Save
                  </Button>
                </div>
              )}
            </div>
            <EventTypePicker
              value={events}
              onChange={setDraftEvents}
              disabled={updateMutation.isPending}
            />
          </section>

          <Separator />

          <ErrorBoundary title="Could not load deliveries">
            <DeliveryLog endpointId={endpoint.id} />
          </ErrorBoundary>
        </>
      ) : null}

      <CreatedSecretDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}
