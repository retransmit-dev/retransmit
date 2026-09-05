"use client";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

const DOMAIN_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const LABEL_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

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
            ? `${created.name} added and already verified`
            : `${created.name} added. Publish its DNS records to verify it.`,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto p-4 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle>Add a domain</SheetTitle>
          <SheetDescription>
            Pick where the domain sends from, then publish its DNS records to verify it.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
            <Label id="domain-region-label">Region</Label>
            {regions.isLoading ? (
              <div className="grid gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <RadioGroup
                aria-labelledby="domain-region-label"
                value={selectedRegion ?? undefined}
                onValueChange={(value) => setRegion(value as string)}
                disabled={pending}
              >
                {regions.data?.regions.map((option) => {
                  const checked = option.id === selectedRegion;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        pending && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <RadioGroupItem value={option.id} />
                      <span className="text-lg leading-none" aria-hidden>
                        {option.flag}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">
                          {option.name}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ({option.location})
                          </span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {option.id}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            )}
            <p className="text-xs text-muted-foreground">
              Email from this domain is sent out of the chosen region. It cannot be changed later.
            </p>
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
              Bounces and delivery reports are routed through this subdomain, so it must be a
              subdomain and not the root domain. Keep <code className="font-mono">mail</code>{" "}
              unless it is already in use.
            </p>
          </div>

          <Button type="submit" disabled={pending || !isValid}>
            {pending ? <Spinner /> : <PlusIcon />}
            Add domain
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
