"use client";

import { CountrySelect } from "@/components/selectors/country-select";
import { RegionSelect } from "@/components/selectors/region-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { RouterInputs } from "@/lib/api-types";
import { trpc } from "@/utils/trpc";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import z from "zod";

const PURPOSES = [
  ["otp", "One-time passwords"],
  ["security", "Security alerts"],
  ["account", "Account notices"],
  ["reminder", "Reminders"],
  ["status_update", "Status updates"],
] as const;

type CreateProgramInput = RouterInputs["smsSender"]["create"];
type Purpose = CreateProgramInput["purposes"][number];

const programSchema = z
  .object({
    senderId: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(11, "Sender IDs are at most 11 characters.")
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9 _-]*$/,
        "Use letters, digits, spaces, hyphens, or underscores.",
      ),
    countries: z.array(z.literal("CM")).length(1, "Cameroon is the only launch destination."),
    region: z.literal("af-south-1"),
    useCase: z.string().trim().min(30, "Describe the recipient and trigger in at least 30 characters.").max(1000),
    sampleMessage: z.string().trim().min(20, "Provide a representative message.").max(1000),
    companyName: z.string().trim().min(2).max(200),
    companyWebsite: z.url({ protocol: /^https$/ }).max(500),
    optInUrl: z.url({ protocol: /^https$/ }).max(500),
    privacyUrl: z.url({ protocol: /^https$/ }).max(500),
    termsUrl: z.url({ protocol: /^https$/ }).max(500),
    supportEmail: z.email().max(320),
    optOutText: z.string().trim().min(10).max(160),
    purposes: z.array(z.enum(PURPOSES.map(([value]) => value))).min(1, "Select a purpose."),
    expectedDailyVolume: z.number().int().min(1).max(100_000),
    expectedMonthlyVolume: z.number().int().min(1).max(3_000_000),
  })
  .refine((value) => value.expectedMonthlyVolume >= value.expectedDailyVolume, {
    path: ["expectedMonthlyVolume"],
    message: "Monthly volume must be at least the daily volume.",
  });

const defaultValues = {
  senderId: "DISCOLAIRE",
  countries: ["CM"] as string[],
  region: "af-south-1",
  useCase: "",
  sampleMessage: "",
  companyName: "Logesta Labs LLC",
  companyWebsite: "https://discolaire.com",
  optInUrl: "https://discolaire.com/sms-opt-in",
  privacyUrl: "https://discolaire.com/privacy",
  termsUrl: "https://discolaire.com/sms-terms",
  supportEmail: "support@discolaire.com",
  optOutText: "Opt out: discolaire.com/sms-opt-in",
  purposes: ["otp", "security", "account"] as Purpose[],
  expectedDailyVolume: 500,
  expectedMonthlyVolume: 15_000,
};

function fieldInvalid(meta: { isTouched: boolean; isValid: boolean }) {
  return meta.isTouched && !meta.isValid;
}

/** A reviewed Cameroon SMS program, not merely a sender-id picker. */
export function RequestSenderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const regions = useQuery(trpc.smsSender.regions.queryOptions());
  const createMutation = useMutation(
    trpc.smsSender.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(trpc.smsSender.pathFilter());
        onOpenChange(false);
        toast.success(`${created.senderId} submitted for compliance review`);
      },
    }),
  );

  const form = useForm({
    defaultValues,
    validators: { onSubmit: programSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        ...value,
        countries: value.countries as CreateProgramInput["countries"],
        region: value.region as CreateProgramInput["region"],
        purposes: value.purposes as CreateProgramInput["purposes"],
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Request an SMS program</DialogTitle>
          <DialogDescription>
            Cameroon only. Sending stays blocked until the business, opt-in flow, content, and
            limits are reviewed.
          </DialogDescription>
        </DialogHeader>
        <form
          id="sms-program-form"
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <DialogBody>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Program identity</FieldLegend>
                <FieldDescription>The brand recipients see and the business behind it.</FieldDescription>
                <FieldGroup>
                  <form.Field name="senderId">
                    {(field) => {
                      const invalid = fieldInvalid(field.state.meta);
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name}>Sender ID</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            maxLength={11}
                            autoCapitalize="characters"
                            aria-invalid={invalid}
                          />
                          <FieldDescription>3–11 characters; every message is prefixed with it.</FieldDescription>
                          {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="companyName">
                    {(field) => (
                      <Field data-invalid={fieldInvalid(field.state.meta)}>
                        <FieldLabel htmlFor={field.name}>Legal company</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={fieldInvalid(field.state.meta)}
                        />
                        {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="companyWebsite">
                    {(field) => (
                      <Field data-invalid={fieldInvalid(field.state.meta)}>
                        <FieldLabel htmlFor={field.name}>Application website</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="url"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={fieldInvalid(field.state.meta)}
                        />
                        {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="countries">
                    {(field) => (
                      <Field data-invalid={fieldInvalid(field.state.meta)}>
                        <FieldLabel htmlFor={field.name}>Destination</FieldLabel>
                        <CountrySelect
                          id={field.name}
                          value={field.state.value}
                          onValueChange={field.handleChange}
                        />
                        <FieldDescription>Production SMS is currently limited to Cameroon.</FieldDescription>
                        {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="region">
                    {(field) => (
                      <Field data-invalid={fieldInvalid(field.state.meta)}>
                        <FieldLabel htmlFor={field.name}>AWS region</FieldLabel>
                        <RegionSelect
                          id={field.name}
                          regions={regions.data?.regions}
                          value={field.state.value}
                          onValueChange={field.handleChange}
                          loading={regions.isLoading}
                        />
                        <FieldDescription>Africa (Cape Town) is the launch region.</FieldDescription>
                        {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    )}
                  </form.Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Consent evidence</FieldLegend>
                <FieldDescription>All links must be public HTTPS pages a reviewer can open.</FieldDescription>
                <FieldGroup>
                  {([
                    ["optInUrl", "Opt-in page", "https://discolaire.com/sms-opt-in"],
                    ["privacyUrl", "Privacy policy", "https://discolaire.com/privacy"],
                    ["termsUrl", "SMS terms", "https://discolaire.com/sms-terms"],
                  ] as const).map(([name, label, placeholder]) => (
                    <form.Field key={name} name={name}>
                      {(field) => (
                        <Field data-invalid={fieldInvalid(field.state.meta)}>
                          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="url"
                            placeholder={placeholder}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={fieldInvalid(field.state.meta)}
                          />
                          {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                        </Field>
                      )}
                    </form.Field>
                  ))}
                  <form.Field name="supportEmail">
                    {(field) => (
                      <Field data-invalid={fieldInvalid(field.state.meta)}>
                        <FieldLabel htmlFor={field.name}>Recipient support email</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="email"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={fieldInvalid(field.state.meta)}
                        />
                        {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="optOutText">
                    {(field) => (
                      <Field data-invalid={fieldInvalid(field.state.meta)}>
                        <FieldLabel htmlFor={field.name}>One-way sender opt-out text</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          maxLength={160}
                          aria-invalid={fieldInvalid(field.state.meta)}
                        />
                        <FieldDescription>
                          Automatically appended because an alphanumeric ID cannot receive STOP.
                        </FieldDescription>
                        {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    )}
                  </form.Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Approved traffic</FieldLegend>
                <FieldDescription>No promotional purpose is available in this launch.</FieldDescription>
                <form.Field name="purposes">
                  {(field) => {
                    const invalid = fieldInvalid(field.state.meta);
                    return (
                      <Field data-invalid={invalid}>
                        <FieldGroup data-slot="checkbox-group" className="gap-3">
                          {PURPOSES.map(([value, label]) => (
                            <Field key={value} orientation="horizontal">
                              <Checkbox
                                id={`purpose-${value}`}
                                checked={field.state.value.includes(value)}
                                onCheckedChange={(checked) =>
                                  field.handleChange(
                                    checked
                                      ? [...new Set([...field.state.value, value])]
                                      : field.state.value.filter((purpose) => purpose !== value),
                                  )
                                }
                              />
                              <FieldLabel htmlFor={`purpose-${value}`}>{label}</FieldLabel>
                            </Field>
                          ))}
                        </FieldGroup>
                        {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    );
                  }}
                </form.Field>
                <FieldGroup>
                  {([
                    ["useCase", "Use case", "Discolaire users request verification codes and opt into school account notifications...", 4],
                    ["sampleMessage", "Representative message", "DISCOLAIRE: Your verification code is 123456. It expires in 10 minutes.", 3],
                  ] as const).map(([name, label, placeholder, rows]) => (
                    <form.Field key={name} name={name}>
                      {(field) => (
                        <Field data-invalid={fieldInvalid(field.state.meta)}>
                          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                          <Textarea
                            id={field.name}
                            name={field.name}
                            placeholder={placeholder}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            rows={rows}
                            maxLength={1000}
                            aria-invalid={fieldInvalid(field.state.meta)}
                          />
                          {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                        </Field>
                      )}
                    </form.Field>
                  ))}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      ["expectedDailyVolume", "Expected recipients/day"],
                      ["expectedMonthlyVolume", "Expected recipients/month"],
                    ] as const).map(([name, label]) => (
                      <form.Field key={name} name={name}>
                        {(field) => (
                          <Field data-invalid={fieldInvalid(field.state.meta)}>
                            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              min={1}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                              aria-invalid={fieldInvalid(field.state.meta)}
                            />
                            {fieldInvalid(field.state.meta) ? <FieldError errors={field.state.meta.errors} /> : null}
                          </Field>
                        )}
                      </form.Field>
                    ))}
                  </div>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || createMutation.isPending}
                >
                  {isSubmitting || createMutation.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <PlusIcon data-icon="inline-start" />
                  )}
                  Submit for review
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
