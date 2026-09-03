"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AcceptInvitationPage() {
  const params = useParams<{ id: string }>();
  const invitationId = params.id;
  const router = useRouter();
  const session = authClient.useSession();

  const invitation = useQuery({
    queryKey: ["invitation", invitationId],
    enabled: Boolean(session.data),
    retry: false,
    queryFn: async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (error) {
        throw new Error(
          error.message ?? "This invitation is invalid or expired",
        );
      }
      return data;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (error) throw new Error(error.message ?? "Could not accept the invitation");
      return data;
    },
    onSuccess: async (data) => {
      const organizationId = data?.invitation.organizationId;
      if (organizationId) {
        await authClient.organization.setActive({ organizationId });
      }
      toast.success("You joined the organization");
      router.push("/");
    },
    onError: (error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.organization.rejectInvitation({ invitationId });
      if (error) throw new Error(error.message ?? "Could not decline the invitation");
    },
    onSuccess: () => {
      toast.success("Invitation declined");
      router.push("/");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {session.isPending || (session.data && invitation.isLoading) ? (
          <CardContent className="p-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        ) : !session.data ? (
          <>
            <CardHeader>
              <CardTitle>You are invited</CardTitle>
              <CardDescription>
                Sign in with the invited email, then reopen this link.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button render={<Link href="/login" />}>Sign in</Button>
            </CardFooter>
          </>
        ) : invitation.isError ? (
          <>
            <CardHeader>
              <CardTitle>Invitation not available</CardTitle>
              <CardDescription>{invitation.error.message}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" render={<Link href="/" />}>
                Dashboard
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Join {invitation.data?.organizationName}</CardTitle>
              <CardDescription>
                Role: <span className="capitalize">{invitation.data?.role}</span>.
                You&apos;ll share its domains and suppressions.
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-2">
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending || rejectMutation.isPending}
              >
                {acceptMutation.isPending && <Spinner />}
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => rejectMutation.mutate()}
                disabled={acceptMutation.isPending || rejectMutation.isPending}
              >
                Decline
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
