import { createElement } from "react";
import { render } from "react-email";
import MagicLinkEmail from "./emails/magic-link";
import OrganizationInvitationEmail from "./emails/organization-invitation";

/* Each helper renders one template to both bodies, so callers always send
   an HTML and a plain-text part together. */

export async function renderMagicLinkEmail(url: string) {
  const email = createElement(MagicLinkEmail, { url });
  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ]);
  return { html, text };
}

export async function renderOrganizationInvitationEmail(props: {
  url: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
}) {
  const email = createElement(OrganizationInvitationEmail, props);
  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ]);
  return { html, text };
}
