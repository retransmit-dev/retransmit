"use client";

import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";

/**
 * The card on file, and the two ways to get one.
 *
 * Stripe splits this in a way no screen wants to think about twice: Checkout is
 * the only thing that creates a subscription, so it is right exactly once, for
 * an organization that has never had one. After that a second session would
 * mean a second subscription, and the portal is where a card is added or
 * replaced. Everything that offers "add a payment method" reads it from here.
 *
 * Runs `billing.overview`, so mount it only where a card is actually in
 * question rather than on every page.
 */
export function usePaymentMethod() {
  const overview = useQuery(trpc.billing.overview.queryOptions());

  // Both routes end at a Stripe page, so the answer is a URL to go to rather
  // than anything to render.
  const redirect = {
    onSuccess: ({ url }: { url: string }) => {
      window.location.href = url;
    },
  };
  const portal = useMutation(trpc.billing.portal.mutationOptions(redirect));
  const checkout = useMutation(trpc.billing.checkout.mutationOptions(redirect));

  const plan = overview.data?.plan;
  const status = overview.data?.status;

  return {
    overview,
    hasPaymentMethod: overview.data?.hasPaymentMethod ?? false,
    /** False on a deployment with no Stripe key, where neither route exists. */
    configured: overview.data?.configured ?? false,
    pending: portal.isPending || checkout.isPending,
    openPortal: () => portal.mutate(),
    addPaymentMethod: () => {
      if (!plan) return;
      if (status === "none") checkout.mutate({ plan });
      else portal.mutate();
    },
  };
}
