"use client";

import { DateRangePicker } from "@/components/date-range-picker";
import type { DateRange } from "@/components/date-range-picker";
import { EMAIL_STATUS_OPTIONS, EmailStatusBadge } from "@/components/status-badges";
import type { EmailStatusValue } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/utils/trpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, MailIcon, SearchIcon } from "lucide-react";
import { Fragment, useDeferredValue, useState } from "react";

const PAGE_SIZE = 25;

const STATUS_ITEMS = [
  { value: "all", label: "All statuses" },
  ...EMAIL_STATUS_OPTIONS.map((option) => ({
    value: option.value as string,
    label: option.label,
  })),
];

const ALL_KEYS = { value: "all", label: "All API keys" };

function defaultRange(): DateRange {
  return { from: startOfDay(subDays(new Date(), 14)), to: endOfDay(new Date()) };
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmailDetailsSheet({
  emailId,
  onClose,
}: {
  emailId: string | null;
  onClose: () => void;
}) {
  const details = useQuery(
    trpc.email.get.queryOptions({ id: emailId ?? "" }, { enabled: emailId !== null }),
  );

  return (
    <Sheet open={emailId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto p-4 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-2">
            <span className="truncate">{details.data?.subject ?? "Email"}</span>
            {details.data && <EmailStatusBadge status={details.data.status} />}
          </SheetTitle>
          <SheetDescription>
            {details.data ? `Sent ${formatDate(details.data.createdAt)}` : null}
          </SheetDescription>
        </SheetHeader>

        {details.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : details.data ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border p-3">
              <span className="text-muted-foreground">From</span>
              <span className="truncate">{details.data.from}</span>
              <span className="text-muted-foreground">To</span>
              <span className="truncate">{details.data.to.join(", ")}</span>
              {details.data.cc && details.data.cc.length > 0 && (
                <>
                  <span className="text-muted-foreground">Cc</span>
                  <span className="truncate">{details.data.cc.join(", ")}</span>
                </>
              )}
              {details.data.replyTo && details.data.replyTo.length > 0 && (
                <>
                  <span className="text-muted-foreground">Reply-To</span>
                  <span className="truncate">{details.data.replyTo.join(", ")}</span>
                </>
              )}
              <span className="text-muted-foreground">Subject</span>
              <span>{details.data.subject}</span>
            </div>

            {details.data.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                {details.data.error}
              </p>
            )}

            {(details.data.html || details.data.text) && (
              <div>
                <h3 className="mb-2 font-medium">Message</h3>
                {details.data.html ? (
                  <iframe
                    title="Email body"
                    sandbox=""
                    srcDoc={details.data.html}
                    className="h-96 w-full rounded-md border bg-white"
                  />
                ) : (
                  <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 font-sans">
                    {details.data.text}
                  </pre>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-2 font-medium">Events</h3>
              <div className="flex flex-col">
                {details.data.events.length === 0 ? (
                  <p className="text-muted-foreground">No events recorded yet.</p>
                ) : (
                  details.data.events.map((event, index) => (
                    <div key={event.id}>
                      {index > 0 && <Separator className="my-2" />}
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs">{event.type}</code>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.createdAt)}
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
                                    {typeof value === "string" ? value : JSON.stringify(value)}
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
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Polls every few seconds so the tiles track a running batch. */
const LIVE_REFETCH_MS = 4000;

function LiveStats() {
  const stats = useQuery(
    trpc.email.stats.queryOptions(undefined, { refetchInterval: LIVE_REFETCH_MS }),
  );

  const counts = stats.data?.counts;
  const failed =
    (counts?.failed ?? 0) + (counts?.bounced ?? 0) + (counts?.rejected ?? 0) +
    (counts?.complained ?? 0) + (counts?.suppressed ?? 0);
  const tiles = [
    { label: "Total", value: stats.data?.total ?? 0 },
    { label: "Queued", value: counts?.queued ?? 0 },
    { label: "Sent", value: counts?.sent ?? 0 },
    { label: "Delivered", value: (counts?.delivered ?? 0) + (counts?.opened ?? 0) + (counts?.clicked ?? 0) },
    { label: "Failed", value: failed },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label} className="py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {tile.value.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function EmailsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [status, setStatus] = useState<string>("all");
  const [apiKeyId, setApiKeyId] = useState<string>("all");
  // Stack of page cursors; the last entry is the current page's cursor.
  const [cursors, setCursors] = useState<Date[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const apiKeys = useQuery(trpc.apiKey.list.queryOptions());
  const keyItems = [
    ALL_KEYS,
    ...(apiKeys.data ?? []).map((key) => ({
      value: key.id,
      label: key.revokedAt ? `${key.name} (revoked)` : key.name,
    })),
  ];

  const emails = useQuery(
    trpc.email.list.queryOptions(
      {
        limit: PAGE_SIZE,
        cursor: cursors[cursors.length - 1],
        search: deferredSearch.trim() || undefined,
        from: range.from,
        to: range.to,
        status: status === "all" ? undefined : (status as EmailStatusValue),
        apiKeyId: apiKeyId === "all" ? undefined : apiKeyId,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const items = emails.data?.items ?? [];
  const nextCursor = emails.data?.nextCursor;
  const filtered = search.trim() !== "" || status !== "all" || apiKeyId !== "all";

  // Every filter change restarts pagination from the first page.
  const changeSearch = (value: string) => {
    setSearch(value);
    setCursors([]);
  };
  const changeRange = (value: DateRange) => {
    setRange(value);
    setCursors([]);
  };
  const changeStatus = (value: string) => {
    setStatus(value);
    setCursors([]);
  };
  const changeApiKey = (value: string) => {
    setApiKeyId(value);
    setCursors([]);
  };

  return (
    <PageShell>
      <PageHeader href="/emails" />

      <LiveStats />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search..."
            aria-label="Search emails"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
          />
        </div>
        <DateRangePicker value={range} onChange={changeRange} />
        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(value) => changeStatus(value as string)}
        >
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={keyItems}
          value={apiKeyId}
          onValueChange={(value) => changeApiKey(value as string)}
        >
          <SelectTrigger className="w-40" aria-label="API key">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {keyItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {emails.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon />
            </EmptyMedia>
            <EmptyTitle>
              {filtered ? "No emails match these filters" : "No emails in this period"}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try a different search, status or API key."
                : "Widen the date range, or send an email through the API and it will show up here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Sent
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(row.id)}
                >
                  <TableCell className="max-w-48 truncate font-medium">
                    {row.to.join(", ")}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {row.subject}
                  </TableCell>
                  <TableCell>
                    <EmailStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                    {formatDate(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(cursors.length > 0 || nextCursor) && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cursors.length === 0 || emails.isFetching}
                    onClick={() => setCursors((stack) => stack.slice(0, -1))}
                  >
                    <ChevronLeftIcon />
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm text-muted-foreground">
                    Page {cursors.length + 1}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!nextCursor || emails.isFetching}
                    onClick={() =>
                      nextCursor &&
                      setCursors((stack) => [...stack, new Date(nextCursor)])
                    }
                  >
                    Next
                    <ChevronRightIcon />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      <EmailDetailsSheet emailId={selectedId} onClose={() => setSelectedId(null)} />
    </PageShell>
  );
}
