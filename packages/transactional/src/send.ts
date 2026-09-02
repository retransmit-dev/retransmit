import { sendEmail } from "@retransmit/email/ses";

import { brand } from "./emails/components/brand";

/**
 * The identity Retransmit's own product emails (sign-in links, invitations)
 * are sent from. Defaults to the shared Logesta Labs address; the identity
 * must be verified in SES for the configured region.
 */
function fromAddress(): string {
  return process.env.TRANSACTIONAL_EMAIL_FROM ?? brand.supportEmail;
}

/**
 * Sends one rendered email through SES. Callers pass both bodies from the
 * matching `render*Email` helper; the failure message names the email so a
 * thrown error reads as "the magic link did not go out", not as an SES code.
 */
export async function sendTransactionalEmail({
  email,
  subject,
  html,
  text,
  failureMessage,
}: {
  email: string;
  subject: string;
  html: string;
  text: string;
  failureMessage: string;
}) {
  try {
    await sendEmail({
      from: `${brand.name} <${fromAddress()}>`,
      to: [email],
      subject,
      html,
      text,
    });
  } catch (error) {
    throw new Error(failureMessage, { cause: error });
  }
}
