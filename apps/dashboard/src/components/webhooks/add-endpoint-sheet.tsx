"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { CreatedSecretDialog } from "./created-secret-dialog";
import type { RevealedSecret } from "./created-secret-dialog";
import { EventTypePicker } from "./event-type-picker";
import { ALL_WEBHOOK_EVENTS } from "./event-types";
import type { WebhookEventValue } from "./event-types";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function AddEndpointSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new endpoint's secret so the caller can reveal it once. */
  onCreated: (revealed: RevealedSecret) => void;
}) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  // Every channel is on by default: one endpoint, one secret, all events.
  const [eventTypes, setEventTypes] = useState<WebhookEventValue[]>(ALL_WEBHOOK_EVENTS);

  const trimmedUrl = url.trim();
  const isValid = isHttpUrl(trimmedUrl) && eventTypes.length > 0;

  const reset = () => {
    setUrl("");
    setEventTypes(ALL_WEBHOOK_EVENTS);
  };

  const createMutation = useMutation(
    trpc.webhook.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.webhook.pathFilter());
        onOpenChange(false);
        reset();
        onCreated({ id: created.id, url: created.url, secret: created.secret, reason: "created" });
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    createMutation.mutate({ url: trimmedUrl, eventTypes });
  };

  const pending = createMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto p-4 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="p-0">
          <SheetTitle>Add an endpoint</SheetTitle>
          <SheetDescription>
            Retransmit POSTs signed JSON to this URL. One endpoint can receive email, SMS, and
            WhatsApp events.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://example.com/webhooks/retransmit"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              disabled={pending}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Respond with a 2xx within 10 seconds. Failed deliveries are retried with backoff.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Events</Label>
            <EventTypePicker value={eventTypes} onChange={setEventTypes} disabled={pending} />
            {eventTypes.length === 0 && (
              <p className="text-xs text-destructive">Pick at least one event.</p>
            )}
          </div>

          <SheetFooter className="p-0">
            <Button type="submit" disabled={pending || !isValid}>
              {pending ? <Spinner /> : <PlusIcon />}
              Add endpoint
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export { CreatedSecretDialog };
