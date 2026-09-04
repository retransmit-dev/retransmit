"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useEmbeddedSignup } from "@/hooks/use-embedded-signup";
import type { SignupResult } from "@/hooks/use-embedded-signup";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConicalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import { WhatsappAccountsTable } from "./whatsapp-accounts-table";

/**
 * Owns Meta's Embedded Signup, which loads one SDK per page and so must not
 * be started from two places. The same "Connect a number" control is handed
 * to the header and to the table's empty state.
 */
export function WhatsappView() {
  const queryClient = useQueryClient();
  const config = useQuery(trpc.whatsappAccount.signupConfig.queryOptions());

  const connectMutation = useMutation(
    trpc.whatsappAccount.connect.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success(`${row.phoneNumber} is connected`);
        if (row.error) {
          toast.warning("Finish verification in WhatsApp Manager, then sync.");
        }
      },
    }),
  );

  const signupOptions = useMemo(
    () =>
      config.data
        ? {
            appId: config.data.appId,
            configId: config.data.configId,
            apiVersion: config.data.apiVersion,
            onComplete: (result: SignupResult) => connectMutation.mutate(result),
            onCancel: () => toast.info("WhatsApp signup closed"),
            onError: (message: string) => toast.error(message),
          }
        : null,
    // connectMutation is stable across renders, so only the config matters.
    [config.data],
  );
  const signup = useEmbeddedSignup(signupOptions);

  const configured = config.data !== null && config.data !== undefined;
  const busy = signup.running || connectMutation.isPending;
  const connectButton = (
    <Button onClick={signup.start} disabled={!configured || !signup.ready || busy}>
      {busy ? <Spinner /> : <PlusIcon />}
      Connect a number
    </Button>
  );

  return (
    <>
      <PageHeader
        href="/whatsapp"
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/whatsapp/test" />}
            >
              <FlaskConicalIcon />
              Test send
            </Button>
            {connectButton}
          </>
        }
      />

      {config.isSuccess && !configured && (
        <Alert>
          <AlertTitle>WhatsApp is not configured</AlertTitle>
          <AlertDescription>
            Set WHATSAPP_META_APP_ID, WHATSAPP_META_APP_SECRET and
            WHATSAPP_META_SIGNUP_CONFIG_ID on both servers.
          </AlertDescription>
        </Alert>
      )}

      <ErrorBoundary title="Could not load WhatsApp numbers">
        <WhatsappAccountsTable connectButton={connectButton} />
      </ErrorBoundary>

      <p className="text-xs text-muted-foreground">
        Manage templates in WhatsApp Manager. Remove numbers from the WhatsApp
        Business app before connecting them.
      </p>
    </>
  );
}
