import { createDb } from "@retransmit/db";
import * as schema from "@retransmit/db/schema/auth";
import {
  renderMagicLinkEmail,
  renderOrganizationInvitationEmail,
} from "@retransmit/transactional";
import { sendTransactionalEmail } from "@retransmit/transactional/send";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { magicLink } from "better-auth/plugins/magic-link";

import { resolveActiveOrganization } from "./organization";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    appName: "Retransmit",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
        allowDifferentEmails: false,
      },
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL as string],
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
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
    },
    /**
     * Better Auth's default rule for magic-link sign-in (3 per 10 seconds)
     * still allows 18 emails a minute per IP, and every request there sends
     * one. Tighten it; the other default rules stand.
     */
    rateLimit: {
      customRules: {
        "/sign-in/magic-link": { window: 60, max: 5 },
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
      magicLink({
        expiresIn: 60 * 5,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          const { html, text } = await renderMagicLinkEmail(url);
          await sendTransactionalEmail({
            email,
            subject: "Sign in to Retransmit",
            html,
            text,
            failureMessage: "Unable to send the Retransmit sign-in email.",
          });
        },
      }),
      organization({
        invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
        cancelPendingInvitationsOnReInvite: true,
        sendInvitationEmail: async (data) => {
          const inviteUrl = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}`;
          try {
            const { html, text } = await renderOrganizationInvitationEmail({
              url: inviteUrl,
              organizationName: data.organization.name,
              inviterName: data.inviter.user.name || data.inviter.user.email,
              inviterEmail: data.inviter.user.email,
            });
            await sendTransactionalEmail({
              email: data.email,
              subject: `${data.inviter.user.name} invited you to ${data.organization.name} on Retransmit`,
              html,
              text,
              failureMessage: "Unable to send the Retransmit invitation email.",
            });
          } catch (error) {
            // Invitations still work via a copied link; never fail the
            // invite because the email could not be sent.
            console.error(
              `Failed to send invitation email to ${data.email}`,
              error,
            );
          }
        },
      }),
      nextCookies(),
    ],
  });
}

export const auth = createAuth();
