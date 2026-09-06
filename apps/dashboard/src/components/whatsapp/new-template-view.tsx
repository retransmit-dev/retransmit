"use client";

import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, BracesIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import {
  fillPlaceholders,
  placeholdersAreSequential,
  placeholdersIn,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
} from "./template-draft";
import type { TemplateButtonDraft, TemplateButtonType, TemplateCategory } from "./template-draft";
import { TemplatePreview } from "./template-preview";

const BUTTON_TYPES: { value: TemplateButtonType; label: string }[] = [
  { value: "quick_reply", label: "Quick reply" },
  { value: "url", label: "Open link" },
  { value: "phone_number", label: "Call" },
];

const NAME_PATTERN = /^[a-z0-9_]+$/;

/**
 * The editor on the left, the phone on the right. Placeholders are typed
 * into the body as `{{1}}`, `{{2}}`… (or inserted with the button); each
 * one found gets an example field, and the preview swaps the token for the
 * example as soon as it is typed.
 */
export function NewTemplateView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accounts = useQuery(trpc.whatsappAccount.list.queryOptions());
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("utility");
  const [language, setLanguage] = useState("en_US");
  const [headerText, setHeaderText] = useState("");
  const [headerExample, setHeaderExample] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<TemplateButtonDraft[]>([]);
  const [pendingCursor, setPendingCursor] = useState<number | null>(null);

  // One entry per business account; several numbers can share a WABA.
  const wabaAccounts = useMemo(() => {
    const active = (accounts.data ?? []).filter((row) => row.status === "active");
    const byWaba = new Map<string, (typeof active)[number]>();
    for (const row of active) if (!byWaba.has(row.wabaId)) byWaba.set(row.wabaId, row);
    return [...byWaba.values()];
  }, [accounts.data]);

  useEffect(() => {
    if (!accountId && wabaAccounts[0]) setAccountId(wabaAccounts[0].id);
  }, [accountId, wabaAccounts]);

  // Put the caret after a placeholder inserted with the button.
  useEffect(() => {
    if (pendingCursor === null || !bodyRef.current) return;
    bodyRef.current.focus();
    bodyRef.current.setSelectionRange(pendingCursor, pendingCursor);
    setPendingCursor(null);
  }, [pendingCursor]);

  const selectedAccount = wabaAccounts.find((row) => row.id === accountId) ?? wabaAccounts[0];
  const bodyPlaceholders = placeholdersIn(bodyText);
  const headerPlaceholders = placeholdersIn(headerText);
  const placeholderCount = bodyPlaceholders.length ? Math.max(...bodyPlaceholders) : 0;

  const insertPlaceholder = () => {
    const token = `{{${placeholderCount + 1}}}`;
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? bodyText.length;
    const end = textarea?.selectionEnd ?? bodyText.length;
    setBodyText(`${bodyText.slice(0, start)}${token}${bodyText.slice(end)}`);
    setPendingCursor(start + token.length);
  };

  const setExample = (index: number, value: string) => {
    setExamples((current) => {
      const next = [...current];
      while (next.length < index) next.push("");
      next[index - 1] = value;
      return next;
    });
  };

  const updateButton = (index: number, patch: Partial<TemplateButtonDraft>) => {
    setButtons((current) =>
      current.map((button, i) => (i === index ? { ...button, ...patch } : button)),
    );
  };

  const createMutation = useMutation(
    trpc.whatsappTemplate.create.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.whatsappTemplate.pathFilter());
        toast.success(`${row.name} submitted for review`);
        router.push("/whatsapp/templates");
      },
    }),
  );

  const problems: string[] = [];
  if (name && !NAME_PATTERN.test(name)) {
    problems.push("Name: lowercase letters, digits and underscores only.");
  }
  if (!placeholdersAreSequential(bodyPlaceholders)) {
    problems.push("Placeholders must run {{1}}, {{2}}, {{3}}… without gaps.");
  }
  if (bodyPlaceholders.some((index) => !examples[index - 1]?.trim())) {
    problems.push("Every placeholder needs an example value.");
  }
  if (headerPlaceholders.length > 1 || (headerPlaceholders[0] ?? 1) !== 1) {
    problems.push("The header can hold one placeholder, and it must be {{1}}.");
  } else if (headerPlaceholders.length === 1 && !headerExample.trim()) {
    problems.push("Give an example for the header placeholder.");
  }
  if (placeholdersIn(footerText).length > 0) problems.push("The footer cannot hold placeholders.");
  if (buttons.some((button) => !button.text.trim())) problems.push("Every button needs a label.");
  if (buttons.some((button) => button.type !== "quick_reply" && !button.value.trim())) {
    problems.push("Link and call buttons need a URL or phone number.");
  }

  const ready =
    Boolean(selectedAccount) &&
    name.trim().length > 0 &&
    bodyText.trim().length > 0 &&
    problems.length === 0 &&
    !createMutation.isPending;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready || !selectedAccount) return;
    createMutation.mutate({
      accountId: selectedAccount.id,
      draft: {
        name: name.trim(),
        language,
        category,
        header: headerText.trim()
          ? { text: headerText.trim(), example: headerExample.trim() || undefined }
          : undefined,
        body: { text: bodyText.trim(), examples: examples.slice(0, placeholderCount) },
        footer: footerText.trim() ? { text: footerText.trim() } : undefined,
        buttons: buttons.length
          ? buttons.map((button) =>
              button.type === "url"
                ? { type: "url" as const, text: button.text.trim(), url: button.value.trim() }
                : button.type === "phone_number"
                  ? {
                      type: "phone_number" as const,
                      text: button.text.trim(),
                      phoneNumber: button.value.trim(),
                    }
                  : { type: "quick_reply" as const, text: button.text.trim() },
            )
          : undefined,
      },
    });
  };

  const busy = createMutation.isPending;

  return (
    <>
      <PageHeader
        href="/whatsapp/templates/new"
        actions={
          <Button variant="ghost" nativeButton={false} render={<Link href="/whatsapp/templates" />}>
            <ArrowLeftIcon />
            Templates
          </Button>
        }
      />

      {accounts.isSuccess && wabaAccounts.length === 0 && (
        <Alert>
          <AlertTitle>Connect a number first</AlertTitle>
          <AlertDescription>
            <Link href="/whatsapp" className="underline underline-offset-4">
              Connect a number
            </Link>{" "}
            to create templates.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {wabaAccounts.length > 1 && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="template-account">Business account</Label>
                  <Select
                    items={wabaAccounts.map((row) => ({
                      value: row.id,
                      label: row.verifiedName ? `${row.verifiedName} (${row.phoneNumber})` : row.phoneNumber,
                    }))}
                    value={accountId}
                    onValueChange={(value) => setAccountId(value ?? "")}
                    disabled={busy}
                  >
                    <SelectTrigger id="template-account" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wabaAccounts.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.verifiedName ? `${row.verifiedName} (${row.phoneNumber})` : row.phoneNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[\s-]+/g, "_"))}
                  placeholder="order_ready"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={busy}
                  autoFocus
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    items={TEMPLATE_CATEGORIES.map(({ value, label }) => ({ value, label }))}
                    value={category}
                    onValueChange={(value) => setCategory((value as TemplateCategory) ?? "utility")}
                    disabled={busy}
                  >
                    <SelectTrigger id="template-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="template-language">Language</Label>
                  <Select
                    items={TEMPLATE_LANGUAGES.map(({ value, label }) => ({ value, label }))}
                    value={language}
                    onValueChange={(value) => setLanguage(value ?? "en_US")}
                    disabled={busy}
                  >
                    <SelectTrigger id="template-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_LANGUAGES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-header">
                  Header <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="template-header"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="Your order is on its way"
                  maxLength={60}
                  autoComplete="off"
                  disabled={busy}
                />
                {headerPlaceholders.length === 1 && headerPlaceholders[0] === 1 && (
                  <Input
                    aria-label="Example for the header placeholder"
                    value={headerExample}
                    onChange={(e) => setHeaderExample(e.target.value)}
                    placeholder="Example for {{1}} in the header"
                    maxLength={60}
                    autoComplete="off"
                    disabled={busy}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="template-body">Body</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={insertPlaceholder}
                    disabled={busy}
                  >
                    <BracesIcon />
                    Insert {`{{${placeholderCount + 1}}}`}
                  </Button>
                </div>
                <Textarea
                  ref={bodyRef}
                  id="template-body"
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder={"Hi {{1}}, your order {{2}} is ready for pickup."}
                  maxLength={1024}
                  disabled={busy}
                />
              </div>

              {bodyPlaceholders.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Example values</p>
                  {[...bodyPlaceholders]
                    .sort((a, b) => a - b)
                    .map((index) => (
                      <div key={index} className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
                        <Label htmlFor={`template-example-${index}`} className="font-mono text-xs">
                          {`{{${index}}}`}
                        </Label>
                        <Input
                          id={`template-example-${index}`}
                          value={examples[index - 1] ?? ""}
                          onChange={(e) => setExample(index, e.target.value)}
                          placeholder={index === 1 ? "Amina" : index === 2 ? "#48213" : "Example"}
                          autoComplete="off"
                          disabled={busy}
                        />
                      </div>
                    ))}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-footer">
                  Footer <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="template-footer"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="Reply STOP to opt out"
                  maxLength={60}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {buttons.map((button, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[8.5rem_1fr_1fr_auto]">
                  <Select
                    items={BUTTON_TYPES}
                    value={button.type}
                    onValueChange={(value) =>
                      updateButton(index, { type: (value as TemplateButtonType) ?? "quick_reply", value: "" })
                    }
                    disabled={busy}
                  >
                    <SelectTrigger aria-label="Button type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUTTON_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Button label"
                    value={button.text}
                    onChange={(e) => updateButton(index, { text: e.target.value })}
                    placeholder="Label"
                    maxLength={25}
                    autoComplete="off"
                    disabled={busy}
                  />
                  {button.type === "quick_reply" ? (
                    <div className="hidden sm:block" />
                  ) : (
                    <Input
                      aria-label={button.type === "url" ? "Button URL" : "Button phone number"}
                      value={button.value}
                      onChange={(e) => updateButton(index, { value: e.target.value })}
                      placeholder={button.type === "url" ? "https://example.com/orders" : "+237670000000"}
                      inputMode={button.type === "url" ? "url" : "tel"}
                      autoComplete="off"
                      disabled={busy}
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove button"
                    onClick={() => setButtons((current) => current.filter((_, i) => i !== index))}
                    disabled={busy}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setButtons((current) => [...current, { type: "quick_reply", text: "", value: "" }])
                  }
                  disabled={busy || buttons.length >= 3}
                >
                  <PlusIcon />
                  Add button
                </Button>
              </div>
            </CardContent>
          </Card>

          {problems.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          {createMutation.error && (
            <Alert variant="destructive">
              <AlertTitle>Meta rejected the template</AlertTitle>
              <AlertDescription>{createMutation.error.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" nativeButton={false} render={<Link href="/whatsapp/templates" />}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              {busy ? <Spinner /> : <SendIcon />}
              Submit for review
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <TemplatePreview
            senderName={selectedAccount?.verifiedName}
            content={{
              header: headerText.trim()
                ? fillPlaceholders(headerText.trim(), [headerExample])
                : undefined,
              body: fillPlaceholders(bodyText, examples),
              footer: footerText.trim() || undefined,
              buttons: buttons.map((button) => ({ type: button.type, text: button.text })),
            }}
          />
        </div>
      </form>
    </>
  );
}
