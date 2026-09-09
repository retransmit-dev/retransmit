"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

/** The "Add address" button and the sheet it opens. */
export function AddSuppressionsSheet() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const addMutation = useMutation(
    trpc.suppression.add.mutationOptions({
      onSuccess: ({ added, skipped }) => {
        void queryClient.invalidateQueries(trpc.suppression.pathFilter());
        setOpen(false);
        setValue("");
        toast.success(
          skipped > 0
            ? `${added} added; ${skipped} skipped`
            : `${added} address${added === 1 ? "" : "es"} suppressed`,
        );
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emails = value
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    if (emails.length > 100) {
      toast.error("Limit 100 addresses. Use CSV import for more.");
      return;
    }
    addMutation.mutate({ emails });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Add address
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-4 sm:max-w-md">
          <SheetHeader className="p-0">
            <SheetTitle>Add suppressions</SheetTitle>
            <SheetDescription>
              Blocks addresses until removed. Use @example.com to block a domain.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="suppress-addresses">Addresses</Label>
              <Textarea
                id="suppress-addresses"
                placeholder={"user@example.com\n@example.com"}
                rows={6}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                disabled={addMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                One per line, comma, or space. Limit 100.
              </p>
            </div>
            <Button
              type="submit"
              disabled={addMutation.isPending || !value.trim()}
            >
              {addMutation.isPending ? <Spinner /> : <PlusIcon />}
              Suppress addresses
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
