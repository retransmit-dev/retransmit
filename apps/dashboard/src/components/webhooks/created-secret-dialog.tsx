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

/** Shows a signing secret once, after create or rotate. */
export function CreatedSecretDialog({
  revealed,
  onClose,
}: {
  revealed: RevealedSecret | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={revealed !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription>Copy it now. It won&apos;t be shown again.</DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
            {revealed?.secret}
          </code>
          {revealed && (
            <CopyButton
              value={revealed.secret}
              label="Copy signing secret"
              toastMessage="Secret copied"
              variant="outline"
              iconClassName="size-4"
            />
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
