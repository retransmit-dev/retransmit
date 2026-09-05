"use client";

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
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

/** The trash icon in an endpoint row and the confirmation it opens. */
export function DeleteEndpointDialog({
  endpoint,
  onDeleted,
}: {
  endpoint: { id: string; url: string };
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation(
    trpc.webhook.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.webhook.pathFilter());
        toast.success("Endpoint removed");
        onDeleted?.();
      },
    }),
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Delete ${endpoint.url}`} />
        }
      >
        <Trash2Icon className="size-4 text-destructive" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this endpoint?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="break-all font-mono text-xs">{endpoint.url}</span>
            <br />
            Stops all deliveries to it and drops its delivery history. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: endpoint.id })}>
            Remove endpoint
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
