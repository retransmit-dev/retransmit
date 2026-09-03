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
import { toast } from "sonner";

export function RevokeApiKeyDialog({
  apiKey,
}: {
  apiKey: { id: string; name: string };
}) {
  const queryClient = useQueryClient();
  const revokeMutation = useMutation(
    trpc.apiKey.revoke.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.apiKey.pathFilter());
        toast.success("API key revoked");
      },
    }),
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke “{apiKey.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This key stops working immediately. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => revokeMutation.mutate({ id: apiKey.id })}>
            Revoke key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
