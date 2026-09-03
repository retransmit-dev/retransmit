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

export function DisconnectNumberDialog({
  account,
}: {
  account: { id: string; phoneNumber: string };
}) {
  const queryClient = useQueryClient();
  const disconnectMutation = useMutation(
    trpc.whatsappAccount.disconnect.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success("Number disconnected");
      },
    }),
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Disconnect ${account.phoneNumber}`}
          />
        }
      >
        <Trash2Icon className="size-4 text-destructive" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {account.phoneNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            Stops sending and webhook replies. The number stays in your
            WhatsApp Business Account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => disconnectMutation.mutate({ id: account.id })}
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
