"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Ends the session and sends the browser to the login screen. The redirect is
 * a full navigation so nothing from the signed-in session survives in memory;
 * `onSignedOut` runs just before it, which is where the query cache is cleared.
 */
export function useSignOut(onSignedOut?: () => void) {
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    if (isPending) return;
    setIsPending(true);

    try {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error(error.message || "Unable to sign out.");
        return;
      }

      onSignedOut?.();
      window.location.replace("/login");
    } catch {
      toast.error("Unable to sign out. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return { isPending, signOut };
}
