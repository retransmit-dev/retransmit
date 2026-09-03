"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { CreatedKeyDialog } from "./created-key-dialog";
import type { CreatedKey } from "./created-key-dialog";

/** "Create key", the name dialog, and the one-time reveal that follows. */
export function CreateApiKeyButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);

  const createMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.apiKey.pathFilter());
        setOpen(false);
        setName("");
        setCreatedKey({ name: created.name, key: created.key });
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim()) createMutation.mutate({ name: name.trim() });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Create key
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>Use a name like Production.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="Production"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
              >
                {createMutation.isPending ? <Spinner /> : <PlusIcon />}
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreatedKeyDialog createdKey={createdKey} onClose={() => setCreatedKey(null)} />
    </>
  );
}
