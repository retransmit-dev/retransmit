"use client";

import { WhatsappAccountStatusBadge } from "@/components/status-badges";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmbeddedSignup } from "@/hooks/use-embedded-signup";
import { queryClient, trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircleIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

const QUALITY: Record<string, { label: string; className: string }> = {
  GREEN: { label: "High", className: "text-emerald-600" },
  YELLOW: { label: "Medium", className: "text-amber-600" },
  RED: { label: "Low", className: "text-red-600" },
};

function Quality({ rating }: { rating: string | null }) {
  const option = rating ? QUALITY[rating.toUpperCase()] : undefined;
  if (!option) return <span className="text-muted-foreground">Unknown</span>;
  return <span className={option.className}>{option.label}</span>;
}

export default function WhatsappPage() {
  const config = useQuery(trpc.whatsappAccount.signupConfig.queryOptions());
  const accounts = useQuery(trpc.whatsappAccount.list.queryOptions());

  const connectMutation = useMutation(
    trpc.whatsappAccount.connect.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success(`${row.phoneNumber} is connected`);
        if (row.error) {
          toast.warning("Registration is still pending. Finish verification in WhatsApp Manager, then sync.");
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const syncMutation = useMutation(
    trpc.whatsappAccount.sync.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success(`${row.phoneNumber} synced`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const disconnectMutation = useMutation(
    trpc.whatsappAccount.disconnect.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success("Number disconnected");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const signupOptions = useMemo(
    () =>
      config.data
        ? {
            appId: config.data.appId,
            configId: config.data.configId,
            apiVersion: config.data.apiVersion,
            onComplete: (result: { code: string; wabaId: string; phoneNumberId: string }) =>
              connectMutation.mutate(result),
            onCancel: () => toast.info("WhatsApp signup was closed before finishing"),
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Connect a WhatsApp Business number to send from it with your API key.
          </p>
        </div>
        {connectButton}
      </div>

      {config.isSuccess && !configured && (
        <Alert>
          <AlertTitle>WhatsApp is not set up on this deployment</AlertTitle>
          <AlertDescription>
            Set WHATSAPP_META_APP_ID, WHATSAPP_META_APP_SECRET and
            WHATSAPP_META_SIGNUP_CONFIG_ID on the dashboard and API servers to enable
            connecting numbers.
          </AlertDescription>
        </Alert>
      )}

      {accounts.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !accounts.data || accounts.data.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircleIcon />
            </EmptyMedia>
            <EmptyTitle>No WhatsApp number yet</EmptyTitle>
            <EmptyDescription>
              Connect a number you own through Meta. You will log in with Facebook,
              pick or create your business, and verify the number by SMS or call.
              Takes a few minutes.
            </EmptyDescription>
          </EmptyHeader>
          {connectButton}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Quality</TableHead>
                <TableHead className="hidden md:table-cell">Connected</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.phoneNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.verifiedName ?? "No display name yet"}
                      {row.source === "provisioned" && (
                        <Badge variant="outline" className="ml-2">
                          Retransmit number
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <WhatsappAccountStatusBadge status={row.error ? "pending" : row.status} />
                    {row.error && (
                      <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={row.error}>
                        {row.error}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Quality rating={row.qualityRating} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Sync ${row.phoneNumber}`}
                        disabled={syncMutation.isPending}
                        onClick={() => syncMutation.mutate({ id: row.id })}
                      >
                        <RefreshCwIcon className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Disconnect ${row.phoneNumber}`}
                            />
                          }
                        >
                          <Trash2Icon className="size-4" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect {row.phoneNumber}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sending from this number stops immediately and replies to it
                              no longer reach your webhooks. The number stays on your
                              WhatsApp Business Account; you can reconnect it later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => disconnectMutation.mutate({ id: row.id })}
                            >
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Message templates are managed in WhatsApp Manager on the business you connected.
        A number can only be on one WhatsApp app at a time, so remove it from the WhatsApp
        Business app first if you use it there.
      </p>
    </div>
  );
}
