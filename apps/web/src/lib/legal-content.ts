import type { Route } from "next";

/* Privacy policy and terms of service, as data. The HTML pages and the
   Markdown variants both render from here, so the two representations
   cannot drift apart. Update `updatedLabel` when the text changes. */

export type LegalSection = {
  title: string;
  body: string[];
  points?: string[];
};

export type LegalDoc = {
  href: Route;
  title: string;
  /* Shown under the h1 and in the Markdown variant. */
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
};

const CONTACT_EMAIL = "support@retransmit.dev";

export const PRIVACY_POLICY: LegalDoc = {
  href: "/privacy",
  title: "Privacy policy",
  updatedLabel: "September 2, 2026",
  intro:
    "This policy explains what Retransmit collects, why, and what you can do about it. It covers the retransmit.dev website, the dashboard, and the hosted API. If you self-host Retransmit, this policy does not apply to your instance; you control that data.",
  sections: [
    {
      title: "Who we are",
      body: [
        `Retransmit provides a transactional email API and dashboard at retransmit.dev. For anything in this policy, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "What we collect",
      body: ["We collect only what the service needs to run:"],
      points: [
        "Account data: your name, email address, and profile picture, provided by the sign-in provider you choose (Google or GitHub).",
        "Email data: the emails you send through the API, including recipient addresses, subject lines, content, and delivery events such as bounces and complaints.",
        "Sending configuration: your verified domains, API keys, webhook endpoints, and suppression lists.",
        "Usage data: request logs, credit balance, and send volumes, used for billing and abuse prevention.",
      ],
    },
    {
      title: "Sign in with Google or GitHub",
      body: [
        "When you sign in with Google or GitHub, we receive your name, email address, and profile picture. We use them to create and identify your account. Nothing else is requested and nothing is posted on your behalf.",
        "Retransmit's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
      ],
    },
    {
      title: "How we use your data",
      body: [
        "We use your data to deliver your emails, show you logs and analytics, bill your prepaid balance, secure the platform, and respond to support requests. We do not sell your data. We do not use the content of your emails for advertising or to train models.",
      ],
    },
    {
      title: "Who we share it with",
      body: [
        "Emails are delivered through Amazon Web Services (Amazon SES), and our infrastructure runs on AWS data centers in the European Union and the United States. Payment details are handled by our payment providers; we never see or store card numbers. We share data with authorities only when the law requires it.",
      ],
    },
    {
      title: "Retention and deletion",
      body: [
        "Email logs and events are kept so you can audit your sending, and account data is kept while your account is active. Suppression entries are kept to protect recipients who bounced or complained.",
        `You can delete API keys, domains, and webhook endpoints from the dashboard at any time. To delete your account and its data, email ${CONTACT_EMAIL} and we will remove it, except for records we must keep for legal or billing reasons.`,
      ],
    },
    {
      title: "Security",
      body: [
        "All traffic is encrypted in transit with TLS. API keys are scoped, shown once, and revocable. Webhook payloads are signed with HMAC-SHA256 so you can verify they came from us.",
      ],
    },
    {
      title: "Your rights",
      body: [
        `Depending on where you live, you may have the right to access, correct, export, or delete your personal data. Email ${CONTACT_EMAIL} and we will honor these requests.`,
      ],
    },
    {
      title: "Changes to this policy",
      body: [
        "If this policy changes in a way that matters, we will update the date above and note the change on this page. Continued use of the service after a change means you accept the updated policy.",
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  href: "/terms",
  title: "Terms of service",
  updatedLabel: "September 2, 2026",
  intro:
    "These terms govern your use of the Retransmit hosted service: the retransmit.dev website, the dashboard, and the hosted API. By creating an account or sending email through the service, you agree to them. The self-hosted software is licensed separately under AGPL-3.0 (SDK under MIT) and is not covered by these terms.",
  sections: [
    {
      title: "The service",
      body: [
        "Retransmit is a transactional email API. You bring your recipients and content; we queue, deliver, and report on your emails. We may improve or change features over time.",
      ],
    },
    {
      title: "Your account",
      body: [
        "You need an account to use the service, created by signing in with Google or GitHub. You are responsible for what happens under your account and for keeping your API keys secret. Tell us right away if you believe a key or your account is compromised.",
      ],
    },
    {
      title: "Acceptable use",
      body: [
        "Retransmit is for transactional and other consented email. You agree to:",
      ],
      points: [
        "Send only to recipients who have a relationship with you or have agreed to receive your email.",
        "Comply with applicable law, including anti-spam laws such as CAN-SPAM and GDPR.",
        "Honor unsubscribe requests and not send to addresses on your suppression list.",
        "Not send unlawful, deceptive, or malicious content, including phishing and malware.",
        "Not probe, overload, or interfere with the service.",
      ],
    },
    {
      title: "Credits and payment",
      body: [
        "The hosted service runs on prepaid credits. Credits are consumed per email sent and do not expire while your account is in good standing. Prices are shown before you pay. If something goes wrong with a purchase, contact us and we will sort it out.",
      ],
    },
    {
      title: "Suspension and termination",
      body: [
        "We may suspend or close an account that violates these terms, harms deliverability for other customers, or creates legal risk. Where reasonable, we will warn you first. You can stop using the service and ask us to delete your account at any time.",
      ],
    },
    {
      title: "Disclaimers",
      body: [
        "The service is provided as is. Email delivery depends on third parties, including recipient mail servers, and we cannot guarantee that every message will be delivered or delivered on time. To the maximum extent permitted by law, we disclaim all implied warranties.",
      ],
    },
    {
      title: "Limitation of liability",
      body: [
        "To the maximum extent permitted by law, Retransmit's total liability for any claim arising out of the service is limited to the amount you paid us in the twelve months before the claim. We are not liable for indirect or consequential damages, or for lost profits or data.",
      ],
    },
    {
      title: "Changes to these terms",
      body: [
        "We may update these terms. If a change is material, we will update the date above and note the change on this page. Continued use of the service after a change means you accept the updated terms.",
      ],
    },
    {
      title: "Contact",
      body: [
        `Questions about these terms go to ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const LEGAL_DOCS = [PRIVACY_POLICY, TERMS_OF_SERVICE] as const;
