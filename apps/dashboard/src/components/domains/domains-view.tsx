"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { AddDomainDialog } from "./add-domain-dialog";
import { DomainDetailsDialog } from "./domain-details-dialog";
import { DomainsTable } from "./domains-table";

/**
 * Owns which domain is open and whether the add sheet is showing. Both are
 * shared: the header and the empty state open the add sheet, and adding a
 * domain opens its DNS records straight away.
 */
export function DomainsView() {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        href="/domains"
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add domain
          </Button>
        }
      />

      <ErrorBoundary title="Could not load domains">
        <DomainsTable onSelect={setSelectedId} onAdd={() => setAddOpen(true)} />
      </ErrorBoundary>

      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={setSelectedId}
      />
      <DomainDetailsDialog
        domainId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
