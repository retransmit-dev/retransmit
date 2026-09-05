"use client";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Create form. The secret is revealed once, then the page moves to the endpoint. */
export function NewEndpointView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<WebhookEventValue[]>(ALL_WEBHOOK_EVENTS);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);

  const trimmedUrl = url.trim();
  const isValid = isHttpUrl(trimmedUrl) && eventTypes.length > 0;

  const createMutation = useMutation(
    trpc.webhook.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.webhook.pathFilter());
        setRevealed({ id: created.id, url: created.url, secret: created.secret, reason: "created" });
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    createMutation.mutate({ url: trimmedUrl, eventTypes });
  };

  const pending = createMutation.isPending || revealed !== null;

  return (
    <>
      <PageHeader
        href="/webhooks/new"
        actions={
          <Button variant="ghost" nativeButton={false} render={<Link href="/webhooks" />}>
            <ArrowLeftIcon />
            Webhooks
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex max-w-xl flex-col gap-2">
          <Label htmlFor="webhook-url">URL</Label>
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
        </div>

        <div className="flex flex-col gap-3">
          <Label>Events</Label>
          <EventTypePicker value={eventTypes} onChange={setEventTypes} disabled={pending} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/webhooks" />}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !isValid}>
            {createMutation.isPending ? <Spinner /> : <PlusIcon />}
            Add endpoint
          </Button>
        </div>
      </form>

      <CreatedSecretDialog
        revealed={revealed}
        onClose={() => {
          if (revealed) router.push(`/webhooks/${revealed.id}`);
        }}
      />
    </>
  );
}
