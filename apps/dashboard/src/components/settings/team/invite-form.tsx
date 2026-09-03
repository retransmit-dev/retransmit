"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { fullOrganizationKey, useCurrentOrganization } from "@/hooks/use-organization";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SendIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

type InviteRole = "member" | "admin";

/** Owners and admins invite by email; everyone else sees nothing here. */
export function InviteForm() {
  const queryClient = useQueryClient();
  const { org, canManage } = useCurrentOrganization();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.organization.inviteMember({
        email: email.trim(),
        role,
        organizationId: org!.id,
        resend: true,
      });
      if (error) throw new Error(error.message ?? "Could not send the invitation");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fullOrganizationKey(org?.id) });
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail("");
    },
  });

  if (!org || !canManage) return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email.trim()) inviteMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Label htmlFor="invite-email">Invite someone to {org.name}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="invite-email"
          type="email"
          placeholder="teammate@company.com"
          className="max-w-xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={inviteMutation.isPending}
        />
        <div className="flex items-center gap-1">
          {(["member", "admin"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={role === option ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => setRole(option)}
            >
              {option}
            </Button>
          ))}
        </div>
        <Button type="submit" disabled={inviteMutation.isPending || !email.trim()}>
          {inviteMutation.isPending ? <Spinner /> : <SendIcon />}
          Invite
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Members share domains and suppressions. Admins can manage both.
      </p>
    </form>
  );
}
