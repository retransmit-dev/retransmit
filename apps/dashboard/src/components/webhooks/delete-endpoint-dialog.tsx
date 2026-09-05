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

/** Trash icon in a row, or a labelled button on the endpoint page. */
export function DeleteEndpointDialog({
  endpoint,
  labelled = false,
  onDeleted,
}: {
  endpoint: { id: string; url: string };
  labelled?: boolean;
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
          labelled ? (
            <Button variant="outline" size="sm" />
          ) : (
            <Button variant="ghost" size="icon" aria-label={`Delete ${endpoint.url}`} />
          )
        }
      >
        <Trash2Icon className="size-4 text-destructive" />
        {labelled && "Delete"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this endpoint?</AlertDialogTitle>
          <AlertDialogDescription className="break-all">
            Deliveries to {endpoint.url} stop. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMutation.mutate({ id: endpoint.id })}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
