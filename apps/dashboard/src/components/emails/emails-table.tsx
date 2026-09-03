"use client";

import { decodeTag } from "@/components/emails/email-filters";
import type { EmailFilters } from "@/components/emails/email-filters";
import { EmailStatusBadge } from "@/components/status-badges";
import type { EmailStatusValue } from "@/components/status-badges";
import { TableSkeleton } from "@/components/table-skeleton";
import { Badge } from "@/components/ui/badge";
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
import { EMAILS_PAGE_SIZE } from "@/lib/emails";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, MailIcon } from "lucide-react";
import { useDeferredValue } from "react";

export function EmailsTable({
  filters,
  cursors,
  onCursorsChange,
  onSelect,
}: {
  filters: EmailFilters;
  /** Stack of page cursors; the last entry is the current page's cursor. */
  cursors: Date[];
  onCursorsChange: (update: (stack: Date[]) => Date[]) => void;
  onSelect: (emailId: string) => void;
}) {
  const search = useDeferredValue(filters.search);
  const emails = useQuery(
    trpc.email.list.queryOptions(
      {
        limit: EMAILS_PAGE_SIZE,
        cursor: cursors[cursors.length - 1],
        search: search.trim() || undefined,
        from: filters.range.from,
        to: filters.range.to,
        status:
          filters.status === "all"
            ? undefined
            : (filters.status as EmailStatusValue),
        apiKeyId: filters.apiKeyId === "all" ? undefined : filters.apiKeyId,
        tag: decodeTag(filters.tag),
      },
      { placeholderData: keepPreviousData },
    ),
  );

  const items = emails.data?.items ?? [];
  const nextCursor = emails.data?.nextCursor;
  const filtered =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.apiKeyId !== "all" ||
    filters.tag !== "all";

  if (emails.isLoading) return <TableSkeleton />;

  if (items.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MailIcon />
          </EmptyMedia>
          <EmptyTitle>
            {filtered
              ? "No emails match these filters"
              : "No emails in this period"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Try a different search, status or API key."
              : "Widen the date range or send an email."}
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
              onClick={() => onSelect(row.id)}
            >
              <TableCell className="max-w-48 truncate font-medium">
                {row.to.join(", ")}
              </TableCell>
              <TableCell className="max-w-64 text-muted-foreground">
                <div className="truncate">{row.subject}</div>
                {row.tags && row.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {row.tags.map((tag) => (
                      <Badge
                        key={tag.name}
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {tag.name}: {tag.value}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <EmailStatusBadge status={row.status} />
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
                disabled={cursors.length === 0 || emails.isFetching}
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
                disabled={!nextCursor || emails.isFetching}
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
