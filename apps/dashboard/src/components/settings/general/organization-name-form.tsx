"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentOrganization } from "@/hooks/use-organization";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export function OrganizationNameForm() {
  const queryClient = useQueryClient();
  const { org, canManage, query } = useCurrentOrganization();
  const [draft, setDraft] = useState<string | null>(null);

  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await authClient.organization.update({
        organizationId: org!.id,
        data: { name },
      });
      if (error) throw new Error(error.message ?? "Could not rename organization");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries(trpc.organization.pathFilter());
      setDraft(null);
      toast.success("Organization renamed");
    },
  });

  if (query.isLoading) return <Skeleton className="h-24 w-full max-w-lg" />;
  if (!org) return null;

  const value = draft ?? org.name;
  const unchanged = !value.trim() || value.trim() === org.name;

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!unchanged) renameMutation.mutate(value.trim());
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!canManage || renameMutation.isPending}
        />
        {!canManage && (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can rename it.
          </p>
        )}
      </div>
      {canManage && (
        <Button
          type="submit"
          className="self-start"
          disabled={renameMutation.isPending || unchanged}
        >
          {renameMutation.isPending && <Spinner />}
          Save
        </Button>
      )}
    </form>
  );
}
