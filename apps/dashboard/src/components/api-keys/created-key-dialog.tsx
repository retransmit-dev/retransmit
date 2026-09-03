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

export type CreatedKey = { name: string; key: string };

/** Shows a freshly created key once; it is never retrievable again. */
export function CreatedKeyDialog({
  createdKey,
  onClose,
}: {
  createdKey: CreatedKey | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={createdKey !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            Copy the <span className="font-medium">{createdKey?.name}</span> key
            now. It won&apos;t be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
            {createdKey?.key}
          </code>
          {createdKey && (
            <CopyButton
              value={createdKey.key}
              label="Copy API key"
              toastMessage="API key copied"
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
