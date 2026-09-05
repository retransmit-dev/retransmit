"use client";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type RevealedSecret = {
  id: string;
  url: string;
  secret: string;
  reason: "created" | "rotated";
};

/**
 * Shows an endpoint's signing secret once, right after it is created or
 * rotated. It is never retrievable again, same as an API key.
 */
export function CreatedSecretDialog({
  revealed,
  onClose,
}: {
  revealed: RevealedSecret | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={revealed !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {revealed?.reason === "rotated" ? "Secret rotated" : "Endpoint created"}
          </DialogTitle>
          <DialogDescription>
            Copy the signing secret now. It won&apos;t be shown again.
            {revealed?.reason === "rotated" &&
              " Deliveries from now on are signed with the new secret."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Endpoint</span>
            <code className="truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
              {revealed?.url}
            </code>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Endpoint ID</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
                {revealed?.id}
              </code>
              {revealed && (
                <CopyButton
                  value={revealed.id}
                  label="Copy endpoint ID"
                  toastMessage="Endpoint ID copied"
                  variant="outline"
                  iconClassName="size-4"
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Signing secret</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {revealed?.secret}
              </code>
              {revealed && (
                <CopyButton
                  value={revealed.secret}
                  label="Copy signing secret"
                  toastMessage="Signing secret copied"
                  variant="outline"
                  iconClassName="size-4"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              One secret signs every channel&apos;s deliveries to this endpoint. See{" "}
              <a
                href="https://docs.retransmit.dev/webhooks"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                verifying signatures
              </a>
              .
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
