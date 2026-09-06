"use client";

import type { SmsFilters } from "@/components/sms/sms-filters";
import { SmsStatusBadge } from "@/components/status-badges";
import type { SmsStatusValue } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { SMS_PAGE_SIZE } from "@/lib/sms";
import { trpc } from "@/utils/trpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareTextIcon,
} from "lucide-react";
import { useDeferredValue } from "react";

export function SmsTable({
  filters,
  cursors,
  onCursorsChange,
  onSelect,
}: {
  filters: SmsFilters;
  /** Stack of page cursors; the last entry is the current page's cursor. */
  cursors: Date[];
  onCursorsChange: (update: (stack: Date[]) => Date[]) => void;
  onSelect: (smsId: string) => void;
}) {
  const search = useDeferredValue(filters.search);
  const messages = useQuery(
    trpc.sms.list.queryOptions(
      {
        limit: SMS_PAGE_SIZE,
        cursor: cursors[cursors.length - 1],
        search: search.trim() || undefined,
        from: filters.range.from,
        to: filters.range.to,
        status:
          filters.status === "all"
            ? undefined
            : (filters.status as SmsStatusValue),
        apiKeyId: filters.apiKeyId === "all" ? undefined : filters.apiKeyId,
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const items = messages.data?.items ?? [];
  const nextCursor = messages.data?.nextCursor;
  const filtered =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.apiKeyId !== "all";

  if (messages.isLoading) return <TableSkeleton />;

  if (items.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareTextIcon />
          </EmptyMedia>
          <EmptyTitle>
            {filtered
              ? "No messages match these filters"
              : "No messages in this period"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Try a different search, status or API key."
              : "Widen the date range or send a test message."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>To</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Provider</TableHead>
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
              onClick={() => onSelect(row.id)}
            >
              <TableCell className="max-w-48 font-medium">
                <div className="truncate">{row.to.join(", ")}</div>
                {row.from && (
                  <div className="truncate text-xs text-muted-foreground">
                    from {row.from}
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-72 text-muted-foreground">
                <div className="truncate">{row.text}</div>
                <div className="text-xs">
                  {row.segments} {row.segments === 1 ? "segment" : "segments"}
                  {row.country ? ` · ${row.country}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <SmsStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                {row.provider ?? "—"}
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                {formatDateTime(row.createdAt)}
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
                disabled={cursors.length === 0 || messages.isFetching}
                onClick={() => onCursorsChange((stack) => stack.slice(0, -1))}
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
                disabled={!nextCursor || messages.isFetching}
                onClick={() =>
                  nextCursor &&
                  onCursorsChange((stack) => [...stack, new Date(nextCursor)])
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
  );
}
