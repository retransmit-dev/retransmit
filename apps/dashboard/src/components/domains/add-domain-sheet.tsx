"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

export function AddDomainSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new domain's id, so the caller can open its records. */
  onCreated: (domainId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const createMutation = useMutation(
    trpc.domain.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        onOpenChange(false);
        setName("");
        toast.success(
          created.status === "verified"
            ? `${created.name} added and already verified`
            : `${created.name} added. Publish its DNS records.`,
        );
        onCreated(created.id);
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim()) createMutation.mutate({ name: name.trim() });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-4 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle>Add a domain</SheetTitle>
          <SheetDescription>
            Add a domain to get its verification DNS records.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain-name">Domain</Label>
            <Input
              id="domain-name"
              placeholder="mail.example.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={createMutation.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={createMutation.isPending || !name.trim()}
          >
            {createMutation.isPending ? <Spinner /> : <PlusIcon />}
            Add domain
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
