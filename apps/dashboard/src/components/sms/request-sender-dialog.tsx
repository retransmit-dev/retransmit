"use client";

import { CountrySelect } from "@/components/selectors/country-select";
import { RegionSelect } from "@/components/selectors/region-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

const SENDER_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/;

/**
 * The one setup step SMS has: a name, the destinations, and the region we
 * register it in.
 *
 * The registration questions — use case, sample message, legal entity — are
 * not rendered at all until a selected country is one the carriers make us
 * file for. They used to sit there marked "(optional)", which is a form
 * asking for work nobody consumes: in most countries the sender id goes
 * upstream as-is. The platform asks for exactly what the upstream does.
 *
 * Countries that do not allow alphanumeric sender ids are listed but
 * disabled, with the reason: the honest answer belongs on screen, not in a
 * support thread after the customer has already integrated.
 */
export function RequestSenderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const catalog = useQuery(trpc.smsSender.countries.queryOptions());
  const regions = useQuery(trpc.smsSender.regions.queryOptions());

  const [senderId, setSenderId] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [region, setRegion] = useState<string | null>(null);
  const [useCase, setUseCase] = useState("");
  const [sampleMessage, setSampleMessage] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");

  const trimmedSender = senderId.trim();
  const selectedRegion = region ?? regions.data?.defaultRegion ?? null;

  // Which of the picked destinations actually get filed with a carrier. Only
  // those bring up the registration questions; the same rule runs again in
  // the router, which is what the API contract is.
  const filedCountries = useMemo(() => {
    const list = catalog.data?.countries ?? [];
    return countries.filter(
      (code) => list.find((country) => country.code === code)?.senderId === "registration",
    );
  }, [catalog.data, countries]);
  const needsFiling = filedCountries.length > 0;

  const isValid =
    trimmedSender.length >= 3 &&
    trimmedSender.length <= 11 &&
    SENDER_ID_REGEX.test(trimmedSender) &&
    countries.length > 0 &&
    selectedRegion !== null &&
    (!needsFiling ||
      (useCase.trim().length >= 10 &&
        sampleMessage.trim().length >= 10 &&
        companyName.trim().length >= 2));

  const reset = () => {
    setSenderId("");
    setCountries([]);
    setRegion(null);
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
        toast.success(
          needsFiling
            ? `${created.senderId} requested. We will file the registration.`
            : `${created.senderId} requested. No carrier filing needed here, so review is quick.`,
        );
      },
    }),
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || selectedRegion === null) return;
    createMutation.mutate({
      senderId: trimmedSender,
      countries: countries as [string, ...string[]],
      region: selectedRegion as NonNullable<typeof regions.data>["regions"][number]["id"],
      // Only sent when a filing will actually consume them.
      useCase: needsFiling ? useCase.trim() || undefined : undefined,
      sampleMessage: needsFiling ? sampleMessage.trim() || undefined : undefined,
      companyName: needsFiling ? companyName.trim() || undefined : undefined,
      companyWebsite: needsFiling ? companyWebsite.trim() || undefined : undefined,
    });
  };

  const pending = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request a sender id</DialogTitle>
          <DialogDescription>
            The name your messages arrive from. Carriers approve it per country.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="gap-5">
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
                3 to 11 characters. Shown instead of a phone number.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sender-countries">Countries</Label>
              <CountrySelect
                id="sender-countries"
                value={countries}
                onValueChange={setCountries}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Where these messages land. Search by name, ISO code or dial code.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sender-region">Region</Label>
              <RegionSelect
                id="sender-region"
                regions={regions.data?.regions}
                value={selectedRegion ?? undefined}
                onValueChange={setRegion}
                loading={regions.isLoading}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Where we register the name. It can only send from there, so this cannot be changed
                later.
              </p>
            </div>

            {/* Only what a filing consumes. In every other country the sender id
                goes upstream as-is, so there is nothing to ask. */}
            {needsFiling && (
              <>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {filedCountries.join(", ")} needs the name registered with the carriers. The rest
                  goes on that filing.
                </p>

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
                    Carriers reject filings whose sample does not match the traffic.
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
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="sender-website">Website (optional)</Label>
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
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="submit" disabled={pending || !isValid}>
              {pending ? <Spinner /> : <PlusIcon />}
              Request sender id
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
