"use client";

import { PageHeader } from "@/components/page-shell";
import { WhatsappTemplateStatusBadge } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@retransmit/api/routers/index";
import { ArrowLeftIcon, EyeIcon, LayoutTemplateIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { placeholdersIn, previewFromComponents } from "./template-draft";
import { TemplatePreview } from "./template-preview";

type TemplateRow = inferRouterOutputs<AppRouter>["whatsappTemplate"]["list"][number];

const CATEGORY_LABEL: Record<string, string> = {
  utility: "Utility",
  marketing: "Marketing",
  authentication: "Authentication",
};

export function TemplatesView() {
  const queryClient = useQueryClient();
  const templates = useQuery(trpc.whatsappTemplate.list.queryOptions());
  const accounts = useQuery(trpc.whatsappAccount.list.queryOptions());
  const [selected, setSelected] = useState<TemplateRow | null>(null);

  const syncMutation = useMutation(
    trpc.whatsappTemplate.sync.mutationOptions({
      onSuccess: ({ count }) => {
        void queryClient.invalidateQueries(trpc.whatsappTemplate.pathFilter());
        toast.success(count === 1 ? "1 template synced" : `${count} templates synced`);
      },
    }),
  );

  const connected = (accounts.data ?? []).some((row) => row.status === "active");
  const senderName = accounts.data?.find((row) => row.status === "active")?.verifiedName;

  const newButton = (
    <Button
      nativeButton={false}
      render={<Link href="/whatsapp/templates/new" />}
      disabled={!connected}
      title={connected ? undefined : "Connect a WhatsApp number first"}
    >
      <PlusIcon />
      New template
    </Button>
  );

  return (
    <>
      <PageHeader
        href="/whatsapp/templates"
        actions={
          <>
            <Button variant="ghost" nativeButton={false} render={<Link href="/whatsapp" />}>
              <ArrowLeftIcon />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={!connected || syncMutation.isPending}
            >
              {syncMutation.isPending ? <RefreshCwIcon className="animate-spin" /> : <RefreshCwIcon />}
              Sync from Meta
            </Button>
            {newButton}
          </>
        }
      />

      {templates.isLoading ? (
        <TableSkeleton rows={3} />
      ) : !templates.data || templates.data.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutTemplateIcon />
            </EmptyMedia>
            <EmptyTitle>No templates yet</EmptyTitle>
          </EmptyHeader>
          <div className="flex gap-2">{newButton}</div>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Updated</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.data.map((row) => (
              <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
                <TableCell>
                  <div className="font-mono text-sm font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.language}</div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary">{CATEGORY_LABEL[row.category] ?? row.category}</Badge>
                </TableCell>
                <TableCell>
                  <WhatsappTemplateStatusBadge status={row.status} />
                  {row.rejectedReason && (
                    <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={row.rejectedReason}>
                      {row.rejectedReason}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(row.updatedAt)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Preview ${row.name}`}
                      onClick={() => setSelected(row)}
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                    <DeleteTemplateDialog template={row} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-3xl">
          {selected && (
            <>
              <SheetHeader className="pr-12">
                <SheetTitle className="font-mono">{selected.name}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <WhatsappTemplateStatusBadge status={selected.status} />
                  <span>
                    {CATEGORY_LABEL[selected.category] ?? selected.category} · {selected.language}
                  </span>
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 px-4 pb-6 md:grid-cols-[22rem_minmax(0,1fr)]">
                <TemplatePreview
                  senderName={senderName}
                  content={previewFromComponents(selected.components)}
                  className="w-full max-w-[22rem] justify-self-center md:justify-self-start"
                />
                <div className="flex min-w-0 flex-col gap-5">
                  {selected.rejectedReason && (
                    <Alert variant="destructive">
                      <AlertDescription>{selected.rejectedReason}</AlertDescription>
                    </Alert>
                  )}
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{CATEGORY_LABEL[selected.category] ?? selected.category}</dd>
                    <dt className="text-muted-foreground">Language</dt>
                    <dd>{selected.language}</dd>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd>{formatDate(selected.updatedAt)}</dd>
                    {selected.lastSyncedAt && (
                      <>
                        <dt className="text-muted-foreground">Synced</dt>
                        <dd>{formatDate(selected.lastSyncedAt)}</dd>
                      </>
                    )}
                  </dl>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Send it</span>
                    <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                      {sendSnippet(selected)}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * The `retransmit.whatsapp.send` call for a template, with one `parameters`
 * entry per placeholder prefilled from the examples Meta keeps on the
 * template.
 */
function sendSnippet(row: TemplateRow): string {
  const components: string[] = [];
  for (const component of row.components) {
    const type = String(component.type ?? "").toUpperCase();
    const text = typeof component.text === "string" ? component.text : "";
    const example = component.example as { header_text?: string[]; body_text?: string[][] } | undefined;
    const placeholders = placeholdersIn(text);
    if (placeholders.length === 0) continue;
    const samples =
      type === "HEADER" ? (example?.header_text ?? []) : type === "BODY" ? (example?.body_text?.[0] ?? []) : [];
    const parameters = [...placeholders]
      .sort((a, b) => a - b)
      .map((index) => `        { type: "text", text: ${JSON.stringify(samples[index - 1] ?? `value ${index}`)} },`)
      .join("\n");
    components.push(
      `      {\n        type: "${type.toLowerCase()}",\n        parameters: [\n${parameters}\n        ],\n      },`,
    );
  }
  const componentsBlock = components.length
    ? `\n    components: [\n${components.join("\n")}\n    ],`
    : "";
  return `await retransmit.whatsapp.send({
  to: "+237670000000",
  type: "template",
  template: {
    name: ${JSON.stringify(row.name)},
    language: ${JSON.stringify(row.language)},${componentsBlock}
  },
});`;
}

function DeleteTemplateDialog({ template }: { template: TemplateRow }) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation(
    trpc.whatsappTemplate.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.whatsappTemplate.pathFilter());
        toast.success(`${template.name} deleted`);
      },
    }),
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Delete ${template.name}`} />}
      >
        <Trash2Icon className="size-4 text-destructive" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {template.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes it from your WhatsApp Business Account. The name stays reserved for 30 days.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: template.id })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
