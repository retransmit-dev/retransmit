"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useSignOut } from "@/hooks/use-sign-out";
import { LogOutIcon } from "lucide-react";

export function SignOutMenuItem({ onSignedOut }: { onSignedOut?: () => void }) {
  const { isPending, signOut } = useSignOut(onSignedOut);

  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={isPending}
      onClick={signOut}
    >
      {isPending ? <Spinner /> : <LogOutIcon />}
      {isPending ? "Signing out..." : "Log out"}
    </DropdownMenuItem>
  );
}
