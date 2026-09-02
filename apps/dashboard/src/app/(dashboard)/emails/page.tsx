"use client";

import { EMAIL_STATUS_OPTIONS, EmailStatusBadge } from "@/components/status-badges";
import type { EmailStatusValue } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
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
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, MailIcon } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 25;

const FILTER_ITEMS = [
  { value: "all", label: "All statuses" },
  ...EMAIL_STATUS_OPTIONS.map((option) => ({
    value: option.value as string,
    label: option.label,
  })),
];

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
      <SheetContent side="right" className="overflow-y-auto p-4 sm:max-w-lg">
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

export default function EmailsPage() {
  const [status, setStatus] = useState<string>("all");
  // Stack of page cursors; the last entry is the current page's cursor.
  const [cursors, setCursors] = useState<Date[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const emails = useQuery(
    trpc.email.list.queryOptions({
      limit: PAGE_SIZE,
      cursor: cursors[cursors.length - 1],
      status: status === "all" ? undefined : (status as EmailStatusValue),
    }),
  );

  const items = emails.data?.items ?? [];
  const nextCursor = emails.data?.nextCursor;

  const changeStatus = (value: string) => {
    setStatus(value);
    setCursors([]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Every email sent through your account, with delivery status.
          </p>
        </div>
        <Select
          items={FILTER_ITEMS}
          value={status}
          onValueChange={(value) => changeStatus(value as string)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_ITEMS.map((item) => (
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
              {status === "all" ? "No emails yet" : "No emails with this status"}
            </EmptyTitle>
            <EmptyDescription>
              {status === "all"
                ? "Send your first email through the API and it will show up here."
                : "Try a different status filter."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
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
          </div>

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
    </div>
  );
}
