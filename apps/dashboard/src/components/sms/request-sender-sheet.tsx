"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

const SENDER_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

/**
 * The one setup step SMS has. Everything the form asks for is what a carrier
 * asks for on a sender id registration — use case, a sample message, the
 * legal entity — so the request can be filed without a follow-up email.
 *
 * Countries the carriers do not allow alphanumeric sender ids in are listed
 * but disabled, with the reason: the honest answer belongs on screen, not in
 * a support thread after the customer has already integrated.
 */
export function RequestSenderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const catalog = useQuery(trpc.smsSender.countries.queryOptions());

  const [senderId, setSenderId] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [useCase, setUseCase] = useState("");
  const [sampleMessage, setSampleMessage] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");

  const trimmedSender = senderId.trim();
  const isValid =
    trimmedSender.length >= 3 &&
    trimmedSender.length <= 11 &&
    SENDER_ID_REGEX.test(trimmedSender) &&
    countries.length > 0 &&
    useCase.trim().length >= 10 &&
    sampleMessage.trim().length >= 10 &&
    companyName.trim().length >= 2;

  const reset = () => {
    setSenderId("");
    setCountries([]);
    setSearch("");
    setUseCase("");
    setSampleMessage("");
    setCompanyName("");
    setCompanyWebsite("");
  };

  const createMutation = useMutation(
    trpc.smsSender.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.smsSender.pathFilter());
        onOpenChange(false);
        reset();
        toast.success(`${created.senderId} requested. We will file the registration.`);
      },
    }),
  );

  const filtered = useMemo(() => {
    const list = catalog.data?.countries ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase() === term ||
        country.dialCode.startsWith(term.replace(/^\+/, "")),
    );
  }, [catalog.data, search]);

  const toggleCountry = (code: string) => {
    setCountries((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code],
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;
    createMutation.mutate({
      senderId: trimmedSender,
      countries: countries as [string, ...string[]],
      useCase: useCase.trim(),
      sampleMessage: sampleMessage.trim(),
      companyName: companyName.trim(),
      companyWebsite: companyWebsite.trim() || undefined,
    });
  };

  const pending = createMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto p-4 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="p-0">
          <SheetTitle>Request a sender id</SheetTitle>
          <SheetDescription>
            The name your messages arrive from. Carriers approve it per country, which takes a few
            days.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sender-id">Sender id</Label>
            <Input
              id="sender-id"
              placeholder="ACME"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              maxLength={11}
              autoFocus
              disabled={pending}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              3 to 11 characters, letters and digits. Shown instead of a phone number on the
              handset.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label id="sender-countries-label">Countries</Label>
            <p className="text-xs text-muted-foreground">
              Approval is per country. Pick every destination you send to.
            </p>
            {catalog.isLoading ? (
              <div className="grid gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="relative">
                  <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search countries"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={pending}
                    aria-label="Search countries"
                  />
                </div>
                <div
                  role="group"
                  aria-labelledby="sender-countries-label"
                  className="max-h-64 overflow-y-auto rounded-md border"
                >
                  {filtered.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No country matches “{search}”.
                    </p>
                  ) : (
                    filtered.map((country) => {
                      const unsupported = country.senderId === "unsupported";
                      const checked = countries.includes(country.code);
                      return (
                        <label
                          key={country.code}
                          className={cn(
                            "flex items-start gap-3 border-b px-3 py-2.5 text-sm last:border-b-0",
                            unsupported
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer hover:bg-muted/50",
                          )}
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={checked}
                            disabled={unsupported || pending}
                            onCheckedChange={() => toggleCountry(country.code)}
                          />
                          <span className="text-base leading-none" aria-hidden>
                            {country.flag}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium">{country.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {unsupported
                                ? catalog.data?.unsupportedReason
                                : country.senderId === "registration"
                                  ? "Carrier registration required"
                                  : "No registration needed"}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {countries.length === 0
                    ? "None selected"
                    : `${countries.length} selected: ${countries.join(", ")}`}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sender-use-case">What do you send?</Label>
            <Textarea
              id="sender-use-case"
              placeholder="One-time passcodes and delivery notifications for customers who signed up on our site."
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sender-sample">Sample message</Label>
            <Textarea
              id="sender-sample"
              placeholder="Your Acme code is 123456. It expires in 10 minutes."
              value={sampleMessage}
              onChange={(e) => setSampleMessage(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              Carriers reject registrations whose sample does not match the traffic.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sender-company">Company</Label>
            <Input
              id="sender-company"
              placeholder="Acme SARL"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={200}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              The legal entity behind the sender id, as it appears on your registration.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sender-website">Website</Label>
            <Input
              id="sender-website"
              type="url"
              placeholder="https://acme.com"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              maxLength={300}
              disabled={pending}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <SheetFooter className="p-0">
            <Button type="submit" disabled={pending || !isValid}>
              {pending ? <Spinner /> : <PlusIcon />}
              Request sender id
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
