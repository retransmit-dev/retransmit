"use client";

import { PageHeader } from "@/components/page-shell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { RouterInputs, RouterOutputs } from "@/lib/api-types";
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

/** Select value for "let routing decide" — an empty string is not a valid item. */
const AUTO_PROVIDER = "auto";

/** Select value for "whatever the sender id or env says". */
const AUTO_REGION = "auto";

type ProviderOption = RouterOutputs["sms"]["providers"][number];
type ProviderName = NonNullable<RouterInputs["sms"]["sendTest"]["provider"]>;
type RegionName = NonNullable<RouterInputs["sms"]["sendTest"]["region"]>;

/** What picking this option means, under the select. */
function providerHint(option: ProviderOption | undefined): string {
  if (!option) {
    return "Picks the cheapest configured provider that covers the destination country.";
  }
  if (!option.configured) {
    return "This provider has no credentials in this deployment.";
  }
  // A pinned send never falls back, so say so: the point of pinning is to
  // learn whether that one carrier works, not to get the message through.
  if (option.countries === null) {
    return "Delivers everywhere. A pinned send fails instead of falling back.";
  }
  if (option.countries.length === 0) {
    return "No country coverage configured. A pinned send fails instead of falling back.";
  }
  return `Delivers to ${option.countries.join(", ")}. A number outside that fails instead of falling back.`;
}

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
  const [provider, setProvider] = useState<string>(AUTO_PROVIDER);
  const [region, setRegion] = useState<string>(AUTO_REGION);

  const providers = useQuery(
    trpc.sms.providers.queryOptions(undefined, { throwOnError: false }),
  );
  const regions = useQuery(trpc.sms.regions.queryOptions(undefined, { throwOnError: false }));

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
    sendMutation.mutate({
      from: from.trim() || undefined,
      to,
      text,
      provider: provider === AUTO_PROVIDER ? undefined : (provider as ProviderName),
      region: region === AUTO_REGION ? undefined : (region as RegionName),
    });
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>
              Pin a provider to test it. Left on automatic, the message takes
              the cheapest configured route to the destination country.
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
                  Must be one of your{" "}
                  <Link href="/sms/senders" className="underline underline-offset-2">
                    approved sender ids
                  </Link>{" "}
                  for the destination country. Leave empty for the provider
                  default.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-test-provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(value) => setProvider((value as string) || AUTO_PROVIDER)}
                  disabled={sendMutation.isPending}
                >
                  <SelectTrigger id="sms-test-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_PROVIDER}>
                      Automatic (best route)
                    </SelectItem>
                    {providers.data?.map((option) => (
                      // An unconfigured carrier stays listed but unpickable:
                      // seeing it greyed out answers "why did it not go over
                      // MTN" without a trip to the admin screen.
                      <SelectItem
                        key={option.family}
                        value={option.family}
                        disabled={!option.configured}
                      >
                        {option.label}
                        {!option.configured && " (not configured)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {providerHint(
                    providers.data?.find((option) => option.family === provider),
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sms-test-region">Region</Label>
                <Select
                  value={region}
                  onValueChange={(value) => setRegion((value as string) || AUTO_REGION)}
                  disabled={sendMutation.isPending}
                >
                  <SelectTrigger id="sms-test-region" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_REGION}>
                      Automatic
                      {regions.data ? ` (${regions.data.defaultRegion})` : ""}
                    </SelectItem>
                    {regions.data?.regions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <span aria-hidden>{option.flag}</span>
                        <span>{option.name}</span>
                        <span className="text-muted-foreground">({option.id})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {region === AUTO_REGION
                    ? "The sender id decides, or the deployment default. Only the AWS route has a region."
                    : "Sandbox status and the monthly spend limit are per region, so a region that is out of budget can still work here. Fails if the sender id is registered elsewhere."}
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
        <span>{message.providerName ?? "Routing…"}</span>
        {message.requestedProvider && (
          <>
            <span className="text-muted-foreground">Pinned to</span>
            <span>{message.requestedProvider}</span>
          </>
        )}
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
