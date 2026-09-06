"use client";

import { PageHeader } from "@/components/page-shell";
import { SmsProviders } from "@/components/sms/sms-providers";
import { SmsStatusBadge } from "@/components/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

/** Polls while the queued message moves through the worker. */
const RESULT_REFETCH_MS = 2000;

/**
 * A form on the left, the queued message on the right. The send goes through
 * the same queue and routing as the public API, so what shows up here is
 * exactly what a customer would get.
 */
export function SmsTestSendView() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [text, setText] = useState("Hello from Retransmit.");

  const sendMutation = useMutation(
    trpc.sms.sendTest.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries(trpc.sms.pathFilter());
        toast.success(`Queued for ${result.to} via ${result.provider}`);
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMutation.mutate({ from: from.trim() || undefined, to, text });
  };

  const canSend =
    !sendMutation.isPending && to.trim().length > 4 && text.trim().length > 0;

  return (
    <>
      <PageHeader
        href="/sms/test"
        actions={
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/sms" />}
          >
            <ArrowLeftIcon />
            Back to SMS
          </Button>
        }
      />

      <SmsProviders />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>
              Routed to the cheapest configured provider for the destination
              country, then sent by the worker with retries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-test-from">Sender id</Label>
                <Input
                  id="sms-test-from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="Acme"
                  maxLength={11}
                  autoComplete="off"
                  disabled={sendMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Up to 11 letters or digits. Leave empty for the provider
                  default. Some countries ignore or require registration.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-test-to">To</Label>
                <Input
                  id="sms-test-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="+237670000000"
                  inputMode="tel"
                  autoComplete="off"
                  disabled={sendMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  International format. The country prefix decides the route.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-test-text">Text</Label>
                <Textarea
                  id="sms-test-text"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1600}
                  disabled={sendMutation.isPending}
                />
              </div>

              <Button type="submit" disabled={!canSend}>
                {sendMutation.isPending ? <Spinner /> : <SendIcon />}
                Queue message
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              {sendMutation.data
                ? `Message ${sendMutation.data.id}`
                : "The queued message and its delivery events appear here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sendMutation.error && (
              <Alert variant="destructive">
                <AlertTitle>Not queued</AlertTitle>
                <AlertDescription>{sendMutation.error.message}</AlertDescription>
              </Alert>
            )}
            {sendMutation.data && <TestResult smsId={sendMutation.data.id} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TestResult({ smsId }: { smsId: string }) {
  const details = useQuery(
    trpc.sms.get.queryOptions(
      { id: smsId },
      {
        throwOnError: false,
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return status === "queued" || status === "sent" ? RESULT_REFETCH_MS : false;
        },
      },
    ),
  );
  const message = details.data;
  if (!message) return <Spinner />;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border p-3">
        <span className="text-muted-foreground">Status</span>
        <span>
          <SmsStatusBadge status={message.status} />
        </span>
        <span className="text-muted-foreground">Provider</span>
        <span className="font-mono text-xs">{message.provider ?? "Routing…"}</span>
        {message.providerMessageId && (
          <>
            <span className="text-muted-foreground">Provider id</span>
            <span className="truncate font-mono text-xs">{message.providerMessageId}</span>
          </>
        )}
        <span className="text-muted-foreground">Segments</span>
        <span>{message.segments}</span>
      </div>

      {message.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {message.error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        {message.events.length === 0 ? (
          <p className="text-muted-foreground">Waiting for the worker…</p>
        ) : (
          message.events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-2">
              <code className="text-xs">{event.type}</code>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(event.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
