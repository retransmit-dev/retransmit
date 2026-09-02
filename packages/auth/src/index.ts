import { createDb } from "@retransmit/db";
import * as schema from "@retransmit/db/schema/auth";
import { sendEmail } from "@retransmit/email/ses";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { resolveActiveOrganization } from "./organization";

/** Names and org titles are user input; never interpolate them raw into HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL as string],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Every session starts with an active organization; the user's
          // personal organization is created here on first sign-in.
          before: async (session) => {
            const org = await resolveActiveOrganization(session.userId);
            return { data: { ...session, activeOrganizationId: org.id } };
          },
        },
      },
    },
    secret: process.env.BETTER_AUTH_SECRET as string,
    baseURL: process.env.BETTER_AUTH_URL as string,
    plugins: [
      organization({
        invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
        cancelPendingInvitationsOnReInvite: true,
        sendInvitationEmail: async (data) => {
          const inviteUrl = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}`;
          const from = process.env.INVITATION_EMAIL_FROM;
          if (!from) {
            console.warn(
              `INVITATION_EMAIL_FROM is not set; share this invite link with ${data.email} manually: ${inviteUrl}`,
            );
            return;
          }
          try {
            await sendEmail({
              from,
              to: [data.email],
              subject: `${data.inviter.user.name} invited you to ${data.organization.name} on Retransmit`,
              text: `${data.inviter.user.name} (${data.inviter.user.email}) invited you to join ${data.organization.name} on Retransmit.\n\nAccept the invitation: ${inviteUrl}\n\nThe link expires in 7 days. If you were not expecting this, you can ignore this email.`,
              html: `<p>${escapeHtml(data.inviter.user.name)} (${escapeHtml(data.inviter.user.email)}) invited you to join <strong>${escapeHtml(data.organization.name)}</strong> on Retransmit.</p><p><a href="${inviteUrl}">Accept the invitation</a></p><p>The link expires in 7 days. If you were not expecting this, you can ignore this email.</p>`,
            });
          } catch (error) {
            // Invitations still work via a copied link; never fail the
            // invite because the email could not be sent.
            console.error(`Failed to send invitation email to ${data.email}`, error);
          }
        },
      }),
      nextCookies(),
    ],
  });
}

export const auth = createAuth();
