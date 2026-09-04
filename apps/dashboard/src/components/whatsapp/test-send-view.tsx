"use client";

import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckCircle2Icon, SendIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

type MessageKind = "template" | "text";

const KIND_ITEMS: { value: MessageKind; label: string }[] = [
  { value: "template", label: "Template" },
  { value: "text", label: "Text" },
];

/**
 * A form on the left, the wire exchange on the right. The form is prefilled
 * from env so a recording starts with one click; every field stays editable
 * because Meta's sandbox rotates tokens daily and templates vary by account.
 */
export function TestSendView() {
  const config = useQuery(trpc.whatsappAccount.testConfig.queryOptions());

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<MessageKind>("template");
  const [templateName, setTemplateName] = useState("hello_world");
  const [language, setLanguage] = useState("en_US");
  const [parameters, setParameters] = useState("");
  const [body, setBody] = useState("Hello from Retransmit.");

  // Seed the form once the env defaults arrive; user edits win afterwards.
  useEffect(() => {
    if (!config.data) return;
    setPhoneNumberId((current) => current || config.data.phoneNumberId);
    setTo((current) => current || config.data.recipient);
  }, [config.data]);

  const sendMutation = useMutation(
    trpc.whatsappAccount.sendTest.mutationOptions({
      onSuccess: (result) => {
        if (result.ok) toast.success("Message accepted by Meta");
        else toast.error(result.error ?? "Meta rejected the message");
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const message =
      kind === "text"
        ? { type: "text" as const, body }
        : {
            type: "template" as const,
            name: templateName,
            language,
            bodyParameters: parameters
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          };
    sendMutation.mutate({ phoneNumberId, accessToken, to, message });
  };

  const needsToken = config.data ? !config.data.hasAccessToken && !accessToken.trim() : false;
  const canSend =
    !sendMutation.isPending &&
    phoneNumberId.trim().length > 0 &&
    to.trim().length > 4 &&
    !needsToken &&
    (kind === "text" ? body.trim().length > 0 : templateName.trim().length > 0);

  const result = sendMutation.data;

  return (
    <>
      <PageHeader
        href="/whatsapp/test"
        actions={
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/whatsapp" />}
          >
            <ArrowLeftIcon />
            Back to WhatsApp
          </Button>
        }
      />

      {config.isSuccess && !config.data.phoneNumberId && (
        <Alert>
          <AlertTitle>No sandbox defaults</AlertTitle>
          <AlertDescription>
            Set WHATSAPP_META_TEST_PHONE_NUMBER_ID, WHATSAPP_META_TEST_ACCESS_TOKEN and
            WHATSAPP_META_TEST_RECIPIENT to prefill this form, or type the values below.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>
              Goes straight to the Cloud API
              {config.data ? ` (${config.data.apiVersion})` : ""}. The recipient must be a
              verified test number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="test-phone-number-id">From (phone number ID)</Label>
                <Input
                  id="test-phone-number-id"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="1249322004938864"
                  autoComplete="off"
                  disabled={sendMutation.isPending}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="test-access-token">Access token</Label>
                <Input
                  id="test-access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={
                    config.data?.hasAccessToken
                      ? "Using the server token. Paste one to override."
                      : "Paste the temporary token from Meta"
                  }
                  autoComplete="off"
                  disabled={sendMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Sandbox tokens expire after 24 hours. Never stored.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="test-to">To</Label>
                <Input
                  id="test-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="15183689728"
                  inputMode="tel"
                  autoComplete="off"
                  disabled={sendMutation.isPending}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="test-kind">Type</Label>
                <Select
                  items={KIND_ITEMS}
                  value={kind}
                  onValueChange={(value) => setKind(value as MessageKind)}
                  disabled={sendMutation.isPending}
                >
                  <SelectTrigger id="test-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Text only lands inside a 24 hour window after the recipient
                  writes to the number. Templates always deliver.
                </p>
              </div>

              {kind === "template" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="test-template">Template</Label>
                      <Input
                        id="test-template"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="hello_world"
                        autoComplete="off"
                        disabled={sendMutation.isPending}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="test-language">Language</Label>
                      <Input
                        id="test-language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="en_US"
                        autoComplete="off"
                        disabled={sendMutation.isPending}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="test-parameters">Body parameters</Label>
                    <Textarea
                      id="test-parameters"
                      rows={4}
                      value={parameters}
                      onChange={(e) => setParameters(e.target.value)}
                      placeholder={"John Doe\n123456\nSep 3, 2026"}
                      disabled={sendMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      One per line, in the order of the template&apos;s {"{{1}}"},{" "}
                      {"{{2}}"}… placeholders. Leave empty for templates without them.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="test-body">Body</Label>
                  <Textarea
                    id="test-body"
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={sendMutation.isPending}
                  />
                </div>
              )}

              <Button type="submit" disabled={!canSend}>
                {sendMutation.isPending ? <Spinner /> : <SendIcon />}
                Send message
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Exchange
              {result &&
                (result.ok ? (
                  <Badge variant="secondary">
                    <CheckCircle2Icon className="text-emerald-600" />
                    Accepted, HTTP {result.status}
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircleIcon />
                    Rejected, HTTP {result.status}
                  </Badge>
                ))}
            </CardTitle>
            <CardDescription>
              {result
                ? result.messageId
                  ? `Message id ${result.messageId}`
                  : (result.error ?? "No message id returned")
                : "The request and Meta's reply appear here after you send."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sendMutation.error && (
              <Alert variant="destructive">
                <AlertTitle>Send failed</AlertTitle>
                <AlertDescription>{sendMutation.error.message}</AlertDescription>
              </Alert>
            )}
            <ExchangeBlock
              label="Request"
              hint={result ? `POST ${result.url}` : undefined}
              value={result?.request}
            />
            <ExchangeBlock label="Response" value={result?.response} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ExchangeBlock({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: unknown;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && (
          <span className="truncate font-mono text-xs text-muted-foreground">{hint}</span>
        )}
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {value === undefined ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
