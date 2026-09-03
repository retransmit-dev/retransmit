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

/** The trash icon in a domain row and the confirmation it opens. */
export function DeleteDomainDialog({
  domain,
}: {
  domain: { id: string; name: string };
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation(
    trpc.domain.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        toast.success("Domain removed");
      },
    }),
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Delete ${domain.name}`} />
        }
      >
        <Trash2Icon className="size-4 text-destructive" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {domain.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Stops sending from this domain and removes its DKIM setup.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate({ id: domain.id })}
          >
            Remove domain
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
