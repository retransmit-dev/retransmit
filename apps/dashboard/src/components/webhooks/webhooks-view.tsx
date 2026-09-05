"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { WebhooksTable } from "./webhooks-table";

/** The endpoint list. Creating and inspecting endpoints are their own pages. */
export function WebhooksView() {
  return (
    <>
      <PageHeader
        href="/webhooks"
        actions={
          <Button nativeButton={false} render={<Link href="/webhooks/new" />}>
            <PlusIcon />
            Add endpoint
          </Button>
        }
      />

      <ErrorBoundary title="Could not load webhooks">
        <WebhooksTable />
      </ErrorBoundary>
    </>
  );
}
