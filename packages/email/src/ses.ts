import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  SESv2Client,
  SendEmailCommand,
} from "@aws-sdk/client-sesv2";
import type { DkimStatus } from "@aws-sdk/client-sesv2";
import type { DomainStatus } from "@retransmit/db/schema/email";

export const sesRegion = process.env.AWS_REGION ?? "us-east-1";

// Credentials come from the default provider chain (AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY in .env, or an instance role in production).
let client: SESv2Client | undefined;
export function getSesClient(): SESv2Client {
  client ??= new SESv2Client({ region: sesRegion });
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
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId?: string }> {
  const response = await getSesClient().send(
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

/**
 * Registers a domain identity with SES (Easy DKIM) and returns the DKIM
 * tokens the customer must publish as CNAME records. Idempotent: if the
 * identity already exists, the existing tokens are returned.
 */
export async function createDomainIdentity(name: string): Promise<{ dkimTokens: string[] }> {
  try {
    const response = await getSesClient().send(
      new CreateEmailIdentityCommand({ EmailIdentity: name }),
    );
    return { dkimTokens: response.DkimAttributes?.Tokens ?? [] };
  } catch (error) {
    if (error instanceof Error && error.name === "AlreadyExistsException") {
      const existing = await getDomainIdentity(name);
      return { dkimTokens: existing.dkimTokens };
    }
    throw error;
  }
}

export async function getDomainIdentity(
  name: string,
): Promise<{ status: DomainStatus; dkimTokens: string[] }> {
  const response = await getSesClient().send(
    new GetEmailIdentityCommand({ EmailIdentity: name }),
  );
  return {
    status: mapDkimStatus(response.DkimAttributes?.Status, response.VerifiedForSendingStatus),
    dkimTokens: response.DkimAttributes?.Tokens ?? [],
  };
}

export async function deleteDomainIdentity(name: string): Promise<void> {
  try {
    await getSesClient().send(new DeleteEmailIdentityCommand({ EmailIdentity: name }));
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

export interface DnsRecord {
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  purpose: "dkim" | "dmarc";
  required: boolean;
}

/** DNS records the customer must publish to verify a domain. */
export function dnsRecordsForDomain(name: string, dkimTokens: string[]): DnsRecord[] {
  const records: DnsRecord[] = dkimTokens.map((token) => ({
    type: "CNAME",
    name: `${token}._domainkey.${name}`,
    value: `${token}.dkim.amazonses.com`,
    purpose: "dkim",
    required: true,
  }));
  records.push({
    type: "TXT",
    name: `_dmarc.${name}`,
    value: "v=DMARC1; p=none;",
    purpose: "dmarc",
    required: false,
  });
  return records;
}
