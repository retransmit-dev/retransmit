import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import type { DkimStatus, MailFromDomainStatus } from "@aws-sdk/client-sesv2";
import type { DomainStatus } from "@retransmit/db/schema/email";

import { DEFAULT_SES_REGION } from "./regions";

/** @deprecated Use DEFAULT_SES_REGION; kept for callers that predate regions. */
export const sesRegion = DEFAULT_SES_REGION;

// Credentials come from the default provider chain (AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY in .env, or an instance role in production). One
// client per region: SES identities and quotas are regional, so a domain is
// always talked to in the region it was verified in.
const clients = new Map<string, SESv2Client>();
export function getSesClient(region: string = DEFAULT_SES_REGION): SESv2Client {
  let client = clients.get(region);
  if (!client) {
    client = new SESv2Client({ region });
    clients.set(region, client);
  }
  return client;
}

export interface SendEmailInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: { name: string; value: string }[];
  /** Region the `from` domain is verified in. Defaults to the platform region. */
  region?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId?: string }> {
  const response = await getSesClient(input.region).send(
    new SendEmailCommand({
      FromEmailAddress: input.from,
      Destination: {
        ToAddresses: input.to,
        CcAddresses: input.cc,
        BccAddresses: input.bcc,
      },
      ReplyToAddresses: input.replyTo,
      ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
      Content: {
        Simple: {
          Subject: { Data: input.subject, Charset: "UTF-8" },
          Headers: input.headers?.map((header) => ({ Name: header.name, Value: header.value })),
          Body: {
            ...(input.html ? { Html: { Data: input.html, Charset: "UTF-8" } } : {}),
            ...(input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {}),
          },
        },
      },
    }),
  );
  return { messageId: response.MessageId };
}

export interface DomainIdentity {
  status: DomainStatus;
  dkimTokens: string[];
  /** Custom MAIL FROM (Return-Path) domain, when one is configured. */
  mailFromDomain: string | null;
  mailFromStatus: DomainStatus | null;
}

/**
 * Registers a domain identity with SES (Easy DKIM) in the given region and
 * returns the DKIM tokens the customer must publish as CNAME records.
 * Idempotent: if the identity already exists, the existing tokens are
 * returned. When `mailFromDomain` is given it is set as the custom MAIL FROM
 * domain; until its MX record resolves SES falls back to amazonses.com so
 * sends never fail on it.
 */
export async function createDomainIdentity(
  name: string,
  options: { region: string; mailFromDomain?: string },
): Promise<{ dkimTokens: string[] }> {
  const client = getSesClient(options.region);
  let dkimTokens: string[];
  try {
    const response = await client.send(new CreateEmailIdentityCommand({ EmailIdentity: name }));
    dkimTokens = response.DkimAttributes?.Tokens ?? [];
  } catch (error) {
    if (!(error instanceof Error && error.name === "AlreadyExistsException")) throw error;
    const existing = await getDomainIdentity(name, options.region);
    dkimTokens = existing.dkimTokens;
  }
  if (options.mailFromDomain) {
    await client.send(
      new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: name,
        MailFromDomain: options.mailFromDomain,
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      }),
    );
  }
  return { dkimTokens };
}

export async function getDomainIdentity(name: string, region: string): Promise<DomainIdentity> {
  const response = await getSesClient(region).send(
    new GetEmailIdentityCommand({ EmailIdentity: name }),
  );
  const mailFrom = response.MailFromAttributes;
  return {
    status: mapDkimStatus(response.DkimAttributes?.Status, response.VerifiedForSendingStatus),
    dkimTokens: response.DkimAttributes?.Tokens ?? [],
    mailFromDomain: mailFrom?.MailFromDomain ?? null,
    mailFromStatus: mailFrom?.MailFromDomain
      ? mapMailFromStatus(mailFrom.MailFromDomainStatus)
      : null,
  };
}

export async function deleteDomainIdentity(name: string, region: string): Promise<void> {
  try {
    await getSesClient(region).send(new DeleteEmailIdentityCommand({ EmailIdentity: name }));
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundException") return;
    throw error;
  }
}

function mapDkimStatus(status: DkimStatus | undefined, verifiedForSending?: boolean): DomainStatus {
  if (verifiedForSending && status === "SUCCESS") return "verified";
  switch (status) {
    case "FAILED":
      return "failed";
    case "TEMPORARY_FAILURE":
      return "temporary_failure";
    default:
      return "pending";
  }
}

function mapMailFromStatus(status: MailFromDomainStatus | undefined): DomainStatus {
  switch (status) {
    case "SUCCESS":
      return "verified";
    case "FAILED":
      return "failed";
    case "TEMPORARY_FAILURE":
      return "temporary_failure";
    default:
      return "pending";
  }
}

export interface DnsRecord {
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  purpose: "dkim" | "dmarc" | "return_path" | "spf";
  required: boolean;
}

/**
 * DNS records the customer must publish to verify a domain. The MX and SPF
 * records for the custom MAIL FROM domain are region-specific: bounces are
 * routed back through the SES feedback host of the region the domain lives in.
 */
export function dnsRecordsForDomain(domain: {
  name: string;
  region: string;
  dkimTokens: string[];
  mailFromDomain: string | null;
}): DnsRecord[] {
  const records: DnsRecord[] = domain.dkimTokens.map((token) => ({
    type: "CNAME",
    name: `${token}._domainkey.${domain.name}`,
    value: `${token}.dkim.amazonses.com`,
    purpose: "dkim",
    required: true,
  }));
  if (domain.mailFromDomain) {
    records.push(
      {
        type: "MX",
        name: domain.mailFromDomain,
        value: `10 feedback-smtp.${domain.region}.amazonses.com`,
        purpose: "return_path",
        required: true,
      },
      {
        type: "TXT",
        name: domain.mailFromDomain,
        value: "v=spf1 include:amazonses.com ~all",
        purpose: "spf",
        required: true,
      },
    );
  }
  records.push({
    type: "TXT",
    name: `_dmarc.${domain.name}`,
    value: "v=DMARC1; p=none;",
    purpose: "dmarc",
    required: false,
  });
  return records;
}
