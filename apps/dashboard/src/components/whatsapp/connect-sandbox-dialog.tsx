"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConicalIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

/**
 * Connects Meta's sandbox number as a regular account. Only rendered when
 * the deployment has WHATSAPP_META_TEST_* set, so production never shows it.
 * The token from API Setup lasts 24 hours; the server swaps it for a 60 day
 * one. Reconnecting with a new token refreshes the stored one in place.
 */
export function ConnectSandboxDialog({
  config,
}: {
  config: { phoneNumberId: string; wabaId: string; hasAccessToken: boolean };
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const connectMutation = useMutation(
    trpc.whatsappAccount.connectSandbox.mutationOptions({
      onSuccess: (row) => {
        void queryClient.invalidateQueries(trpc.whatsappAccount.pathFilter());
        toast.success(`${row.phoneNumber} is connected`);
        setAccessToken("");
        setOpen(false);
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    connectMutation.mutate({ accessToken: accessToken || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FlaskConicalIcon />
        Connect test number
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Connect Meta's test number</DialogTitle>
            <DialogDescription>
              The sandbox number from your Meta app. It can only message the
              recipients you added under API Setup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sandbox-phone-number-id">Phone number ID</Label>
              <Input id="sandbox-phone-number-id" value={config.phoneNumberId} readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sandbox-waba-id">WhatsApp Business Account ID</Label>
              <Input id="sandbox-waba-id" value={config.wabaId} readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sandbox-token">Access token</Label>
              <Textarea
                id="sandbox-token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={
                  config.hasAccessToken
                    ? "Leave blank to use WHATSAPP_META_TEST_ACCESS_TOKEN"
                    : "Paste the temporary token from API Setup"
                }
                className="font-mono text-xs"
                rows={3}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                App Dashboard, WhatsApp, API Setup. The temporary token is
                exchanged for one that lasts about 60 days. Connect again with
                a new one when sends fail with an OAuth error.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={connectMutation.isPending || (!accessToken && !config.hasAccessToken)}
            >
              {connectMutation.isPending ? <Spinner /> : <FlaskConicalIcon />}
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
