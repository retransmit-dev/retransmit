/**
 * Brand facts every email reads from, so a name or a host changes in one
 * place. Retransmit's own product emails (sign-in links, invitations) are
 * sent from the shared Logesta Labs identity until a retransmit.dev mailbox
 * exists.
 */
export const brand = {
  name: "Retransmit",
  legalName: "Logesta Labs LLC",
  siteUrl: "https://retransmit.dev",
  supportEmail: "contact@logestalabs.com",
} as const;
