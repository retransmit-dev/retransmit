"use client";

import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Country names for ISO codes, read from the server rather than mirrored
 * here.
 *
 * The list lives in @retransmit/sms/countries with the sender-id policy that
 * gives each entry its meaning, and the dashboard does not depend on that
 * package (see the note on the status badges: schema constants stay out of the
 * client bundle). It arrives through `smsSender.countries`, which every screen
 * showing a country already loads, so this costs one cached query rather than
 * a second copy of the table that can drift.
 */
export function useCountryLookup(): (code: string) => string {
  const catalog = useQuery(trpc.smsSender.countries.queryOptions());

  return useMemo(() => {
    const names = new Map((catalog.data?.countries ?? []).map((c) => [c.code, c.name]));
    // Before the query resolves the code itself is the honest label: "CM" is
    // recognizable, and a blank cell that fills in later is not.
    return (code: string) => names.get(code.toUpperCase()) ?? code.toUpperCase();
  }, [catalog.data]);
}
