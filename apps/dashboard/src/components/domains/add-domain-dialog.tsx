"use client";

import { RegionSelect } from "@/components/selectors/region-select";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const LABEL_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function AddDomainDialog({
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
  const regions = useQuery(trpc.domain.regions.queryOptions());
  const [name, setName] = useState("");
  const [returnPath, setReturnPath] = useState("mail");
  const [region, setRegion] = useState<string | null>(null);

  const selectedRegion = region ?? regions.data?.defaultRegion ?? null;
  const domainName = name.trim().toLowerCase();
  const returnPathLabel = returnPath.trim().toLowerCase();
  const isValid =
    DOMAIN_REGEX.test(domainName) && LABEL_REGEX.test(returnPathLabel) && selectedRegion !== null;

  const reset = () => {
    setName("");
    setReturnPath("mail");
    setRegion(null);
  };

  const createMutation = useMutation(
    trpc.domain.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.domain.pathFilter());
        onOpenChange(false);
        reset();
        toast.success(
          created.status === "verified"
            ? `${created.name} added and verified`
            : `${created.name} added. Publish its DNS records.`,
        );
        onCreated(created.id);
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || selectedRegion === null) return;
    createMutation.mutate({
      name: domainName,
      region: selectedRegion as NonNullable<typeof regions.data>["regions"][number]["id"],
      returnPath: returnPathLabel,
    });
  };

  const pending = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a domain</DialogTitle>
          <DialogDescription>Choose a sending region, then verify with DNS.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain-name">Domain</Label>
              <Input
                id="domain-name"
                placeholder="example.com"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={pending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="domain-region">Region</Label>
              <RegionSelect
                id="domain-region"
                regions={regions.data?.regions}
                value={selectedRegion ?? undefined}
                onValueChange={setRegion}
                loading={regions.isLoading}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Cannot be changed later.</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="domain-return-path">Return-Path</Label>
              <InputGroup>
                <InputGroupInput
                  id="domain-return-path"
                  placeholder="mail"
                  value={returnPath}
                  onChange={(e) => setReturnPath(e.target.value)}
                  disabled={pending}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="font-mono text-xs">
                    .{domainName || "example.com"}
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <p className="text-xs text-muted-foreground">
                Subdomain for bounces. Keep <code className="font-mono">mail</code> unless it is
                taken.
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="submit" disabled={pending || !isValid}>
              {pending ? <Spinner /> : <PlusIcon />}
              Add domain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
