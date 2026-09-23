"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { InfoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { RequestSenderDialog } from "./request-sender-dialog";
import { SendersTable } from "./senders-table";

/**
 * Approved SMS programs are the thing a customer sets up for SMS. There is no
 * "add provider" step on purpose: which carrier carries a message is a cost
 * decision Retransmit makes per destination, and one API key still covers
 * every channel. What a customer cannot send without is a name the carriers
 * have approved for their countries, which is what this screen is.
 */
export function SendersView() {
  const [requestOpen, setRequestOpen] = useState(false);
  const senders = useQuery(trpc.smsSender.list.queryOptions());

  const hasApproved = senders.data?.some((row) => row.status === "approved") ?? false;
  const hasPending = senders.data?.some((row) => row.status === "pending") ?? false;

  return (
    <>
      <PageHeader
        href="/sms/senders"
        actions={
          <Button onClick={() => setRequestOpen(true)}>
            <PlusIcon />
            Request program
          </Button>
        }
      />

      {/* Shown only while it is actionable: once something is approved the
          customer knows how this works and the banner is noise. */}
      {!hasApproved && (
        <Alert>
          <InfoIcon />
          <AlertTitle>
            {hasPending ? "Your program is under review" : "Messages need an approved SMS program"}
          </AlertTitle>
          <AlertDescription>
            {hasPending
              ? "Sending remains blocked until the sender identity, public opt-in, policy pages, message purposes, and volume limits are approved."
              : "Request a Cameroon program with the public consent flow and transactional purposes recipients explicitly choose."}
          </AlertDescription>
        </Alert>
      )}

      <ErrorBoundary title="Could not load sender ids">
        <SendersTable onRequest={() => setRequestOpen(true)} />
      </ErrorBoundary>

      <RequestSenderDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </>
  );
}
