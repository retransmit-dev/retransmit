"use client";

import { DomainStatusBadge } from "@/components/status-badges";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { GlobeIcon, PlusIcon } from "lucide-react";

import { DeleteDomainDialog } from "./delete-domain-dialog";
import { RegionLabel } from "./region-label";

export function DomainsTable({
  onSelect,
  onAdd,
}: {
  onSelect: (domainId: string) => void;
  onAdd: () => void;
}) {
  const domains = useQuery(trpc.domain.list.queryOptions());

  if (domains.isLoading) return <TableSkeleton rows={2} />;

  if (!domains.data || domains.data.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GlobeIcon />
          </EmptyMedia>
          <EmptyTitle>No domains yet</EmptyTitle>
          <EmptyDescription>
            Add a domain and publish its DKIM records.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onAdd}>
          <PlusIcon />
          Add domain
        </Button>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Domain</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Region</TableHead>
          <TableHead className="hidden sm:table-cell">Added</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {domains.data.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onSelect(row.id)}
          >
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>
              <DomainStatusBadge status={row.status} />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <RegionLabel region={row.region} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {formatDate(row.createdAt)}
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <DeleteDomainDialog domain={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
