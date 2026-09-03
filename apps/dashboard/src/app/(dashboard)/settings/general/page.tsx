"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export default function GeneralSettingsPage() {
  const org = useQuery(trpc.organization.current.queryOptions());
  const [name, setName] = useState<string | null>(null);
  const canManage = org.data?.role === "owner" || org.data?.role === "admin";

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await authClient.organization.update({
        organizationId: org.data!.id,
        data: { name: newName },
      });
      if (error) throw new Error(error.message ?? "Could not rename organization");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries(trpc.organization.pathFilter());
      setName(null);
      toast.success("Organization renamed");
    },
    onError: (error) => toast.error(error.message),
  });

  if (org.isLoading) {
    return <Skeleton className="h-40 w-full max-w-lg" />;
  }
  if (!org.data) return null;

  const value = name ?? org.data.name;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() && value.trim() !== org.data?.name) {
            renameMutation.mutate(value.trim());
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            value={value}
            onChange={(e) => setName(e.target.value)}
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
            disabled={
              renameMutation.isPending || !value.trim() || value.trim() === org.data.name
            }
          >
            {renameMutation.isPending && <Spinner />}
            Save
          </Button>
        )}
      </form>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Slug</span>
        <code className="font-mono">{org.data.slug}</code>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Your role</span>
        <span className="capitalize">{org.data.role}</span>
      </div>
    </div>
  );
}
