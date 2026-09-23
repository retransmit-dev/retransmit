"use client";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BanIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

const PURPOSES = [
  ["otp", "One-time password"],
  ["security", "Security alert"],
  ["account", "Account notice"],
  ["reminder", "Reminder"],
  ["status_update", "Status update"],
] as const;

const DEFAULT_DISCLOSURE =
  "I agree to receive transactional SMS from Discolaire for the selected purpose. Message frequency varies. I can opt out at any time from my Discolaire notification settings. Consent is not a condition of purchase.";

export function SmsComplianceView() {
  const [consentOpen, setConsentOpen] = useState(false);
  const [optOutOpen, setOptOutOpen] = useState(false);
  const records = useQuery(trpc.smsCompliance.list.queryOptions());

  return (
    <>
      <PageHeader
        href="/sms/recipients"
        actions={
          <>
            <Button variant="outline" onClick={() => setOptOutOpen(true)}>
              <BanIcon data-icon="inline-start" />
              Add opt-out
            </Button>
            <Button onClick={() => setConsentOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Record consent
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Consent ledger</CardTitle>
          <CardDescription>
            Exact disclosure, source, time, program, and purposes retained for each Cameroon
            recipient.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Program</TableHead>
                <TableHead className="hidden md:table-cell">Purposes</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead>Consented</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data?.consents.map((consent) => (
                <TableRow key={consent.id}>
                  <TableCell className="font-mono">{consent.phone}</TableCell>
                  <TableCell>{consent.senderId}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex flex-wrap gap-1">
                      {consent.purposes.map((purpose) => (
                        <Badge key={purpose} variant="secondary">
                          {purpose}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate lg:table-cell">
                    {consent.evidenceUrl ? (
                      <a
                        href={consent.evidenceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-2"
                      >
                        {consent.source}
                      </a>
                    ) : (
                      consent.source
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(consent.consentedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={consent.optedOutAt ? "outline" : "secondary"}>
                      {consent.optedOutAt ? "Opted out" : "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {records.data?.consents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No consent records yet. Sending remains blocked.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization suppression list</CardTitle>
          <CardDescription>
            A suppressed number cannot receive SMS from any program in this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data?.suppressions.map((suppression) => (
                <TableRow key={suppression.id}>
                  <TableCell className="font-mono">{suppression.phone}</TableCell>
                  <TableCell>{suppression.reason}</TableCell>
                  <TableCell>{suppression.source}</TableCell>
                  <TableCell>{formatDateTime(suppression.createdAt)}</TableCell>
                </TableRow>
              ))}
              {records.data?.suppressions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No suppressed recipients.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConsentDialog open={consentOpen} onOpenChange={setConsentOpen} />
      <OptOutDialog open={optOutOpen} onOpenChange={setOptOutOpen} />
    </>
  );
}

function ConsentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const programs = useQuery(trpc.smsCompliance.programs.queryOptions());
  const [programId, setProgramId] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number][0]>("account");
  const [source, setSource] = useState("Discolaire web opt-in form");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [disclosureText, setDisclosureText] = useState(DEFAULT_DISCLOSURE);
  const selectedProgram = programs.data?.find((program) => program.id === programId);
  const availablePurposes = PURPOSES.filter(([value]) =>
    selectedProgram?.purposes.includes(value),
  );

  const mutation = useMutation(
    trpc.smsCompliance.record.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.smsCompliance.pathFilter());
        toast.success("Consent recorded");
        onOpenChange(false);
        setPhone("");
      },
    }),
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      smsSenderId: programId,
      phone,
      purposes: [purpose],
      method: "web_form",
      source,
      disclosureText,
      evidenceUrl: evidenceUrl.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record recipient consent</DialogTitle>
          <DialogDescription>
            Use this only after the recipient affirmatively selects SMS on the named form.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="consent-program">Approved program</FieldLabel>
              <Select
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value as string);
                  const firstPurpose = programs.data?.find((program) => program.id === value)
                    ?.purposes[0];
                  if (firstPurpose) setPurpose(firstPurpose);
                }}
                disabled={mutation.isPending}
              >
                <SelectTrigger id="consent-program" className="w-full">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {programs.data?.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.senderId}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="consent-phone">Cameroon phone number</FieldLabel>
              <Input
                id="consent-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+237670000000"
                inputMode="tel"
                disabled={mutation.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="consent-purpose">Purpose selected by recipient</FieldLabel>
              <Select
                value={purpose}
                onValueChange={(value) => setPurpose(value as (typeof PURPOSES)[number][0])}
                disabled={mutation.isPending || !programId}
              >
                <SelectTrigger id="consent-purpose" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availablePurposes.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="consent-source">Form or collection source</FieldLabel>
              <Input
                id="consent-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="consent-evidence">Evidence URL (optional)</FieldLabel>
              <Input
                id="consent-evidence"
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                placeholder="https://discolaire.com/sms-opt-in"
                disabled={mutation.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="consent-disclosure">Exact disclosure shown</FieldLabel>
              <Textarea
                id="consent-disclosure"
                rows={5}
                value={disclosureText}
                onChange={(event) => setDisclosureText(event.target.value)}
                disabled={mutation.isPending}
              />
              <FieldDescription>
                Store the exact wording shown at the time, not a link to text that can change.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !programId ||
                phone.trim().length < 8 ||
                source.trim().length < 3 ||
                disclosureText.trim().length < 20
              }
            >
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Record consent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OptOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Recipient request");
  const mutation = useMutation(
    trpc.smsCompliance.optOut.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.smsCompliance.pathFilter());
        toast.success("Recipient suppressed across the organization");
        onOpenChange(false);
        setPhone("");
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add recipient opt-out</DialogTitle>
          <DialogDescription>
            This immediately blocks every SMS program in the organization from sending to the
            number.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="opt-out-phone">Cameroon phone number</FieldLabel>
            <Input
              id="opt-out-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+237670000000"
              inputMode="tel"
              disabled={mutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="opt-out-source">Request source</FieldLabel>
            <Input
              id="opt-out-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              disabled={mutation.isPending}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            variant="destructive"
            disabled={mutation.isPending || phone.trim().length < 8 || source.trim().length < 3}
            onClick={() =>
              mutation.mutate({ phone, source, reason: "opt_out" })
            }
          >
            {mutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <BanIcon data-icon="inline-start" />
            )}
            Suppress recipient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
