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

const CONTACT_EMAIL = "contact@logestalabs.com";

export const PRIVACY_POLICY: LegalDoc = {
  href: "/privacy",
  title: "Privacy policy",
  updatedLabel: "September 3, 2026",
  intro:
    "This policy explains what Retransmit collects, why we collect it, how long we keep it, who we share it with, and what you can do about it. It covers the retransmit.dev website, the dashboard, and the hosted API. If you self-host Retransmit, this policy does not apply to your instance; you control that data.",
  sections: [
    {
      title: "Who we are",
      body: [
        `Retransmit is a transactional email API and dashboard at retransmit.dev, operated by Logesta Labs LLC. In this policy, "we" and "us" mean Logesta Labs LLC. We are the data controller for your account data and the information described below. For anything in this policy, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "What we collect",
      body: ["We collect only what the service needs to run:"],
      points: [
        "Account data: your name, email address, and profile picture, provided by the sign-in provider you choose (Google or GitHub), or just your email address if you sign in with a magic link, plus the account settings you configure in the dashboard.",
        "Email data: the emails you send through the API, including recipient addresses, subject lines, content, and delivery events such as sends, deliveries, bounces, and complaints.",
        "Sending configuration: your verified domains, API keys, webhook endpoints, and suppression lists.",
        "Usage and billing data: API request logs, credit balance, purchase history, and send volumes, used for billing, capacity planning, and abuse prevention.",
        "Technical data collected automatically: IP address, browser type, and request timestamps, recorded in server logs when you use the website, dashboard, or API. We use this to secure the service and diagnose problems.",
        "Website analytics data: the page URL, referring page, browser window width, a randomly generated visitor identifier, and conversion events such as opening the quickstart. We use this to understand website traffic and which calls to action are useful.",
      ],
    },
    {
      title: "Sign in with Google or GitHub",
      body: [
        "You create a Retransmit account by signing in with Google or GitHub, or with a magic link sent to your email address. A magic link gives us only that email address. Here is exactly how we handle the data we receive from Google and GitHub.",
      ],
      points: [
        "What we access: your basic profile only. That is your name, your email address, and your profile picture. We request no other scopes. We cannot read your Gmail, contacts, calendar, files, or repositories, and we never ask for that access.",
        "How we use it: to create your account, sign you in on later visits, display your identity in the dashboard, and send you service emails about your account, such as billing and security notices.",
        "How we store it: in our database on Amazon Web Services infrastructure, encrypted in transit and at rest, for as long as your account exists.",
        "How we share it: we do not sell it, and we do not share it with anyone except the infrastructure providers that host the service on our behalf. We do not use it for advertising, and we do not transfer it to third parties for their own purposes.",
      ],
    },
    {
      title: "Google API Services disclosure",
      body: [
        "Retransmit's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. Google user data is used only to provide sign-in and the account features described above. It is never used for advertising, never sold, and never used to train generalized machine learning models. Humans do not read it except with your permission, for security purposes, or where the law requires it.",
      ],
    },
    {
      title: "How we use your data",
      body: [
        "We use your data to operate the service: to deliver your emails, show you logs and analytics for your own sending, bill your prepaid balance, prevent spam and abuse, secure the platform, and respond to support requests.",
        "We do not sell your data. We do not serve ads. We do not use the content of your emails for advertising or to train models.",
        "Where the GDPR applies, our legal bases are: performance of our contract with you (running the service you signed up for), legitimate interests (securing the platform and preventing abuse), legal obligation (tax and accounting records), and consent where we ask for it.",
      ],
    },
    {
      title: "Your recipients' data",
      body: [
        "When you send email through Retransmit, you give us the addresses and content of people who are not our customers. For that data you are the controller and we are your processor: we process it only to deliver your emails, record delivery events, and maintain your suppression list, on your instructions. You are responsible for having a lawful basis to email your recipients.",
        `If you received an email sent through Retransmit and have questions about it, contact the sender first; they control that data. You can also reach us at ${CONTACT_EMAIL} and we will help route your request.`,
      ],
    },
    {
      title: "Cookies",
      body: [
        "The dashboard uses first-party session cookies to keep you signed in. The website stores your theme preference in your browser. To measure pageviews and conversion journeys across visits, the website also stores a random visitor identifier in local storage until you clear the site's data and in a first-party _wa_id cookie with a renewable two-year expiry. We do not use advertising cookies or use this identifier for cross-site tracking.",
      ],
    },
    {
      title: "Who we share it with",
      body: [
        "We share data only with the providers we need to run the service:",
      ],
      points: [
        "Amazon Web Services: our infrastructure runs on AWS data centers in the European Union and the United States, and your emails are delivered through Amazon SES.",
        "Slane Analytics: analytics.slane.io receives website page URLs, referrers, browser window widths, random visitor identifiers, and conversion event names and placements so we can measure website usage.",
        "Payment providers: when you buy credits, your payment details go directly to the payment provider. We never see or store card numbers; we receive only confirmation that a payment succeeded.",
        "Authorities: we disclose data to law enforcement or regulators only when the law requires it, and we push back on requests that are overbroad.",
      ],
    },
    {
      title: "International transfers",
      body: [
        "Our infrastructure runs in the European Union and the United States, so your data may be processed in either region. Where data moves out of the European Economic Area, we rely on safeguards such as the European Commission's Standard Contractual Clauses with our providers.",
      ],
    },
    {
      title: "Retention and deletion",
      body: [
        "We keep data only as long as it serves a purpose:",
      ],
      points: [
        "Account data is kept while your account is active and deleted when your account is deleted.",
        "Email logs and delivery events are kept so you can audit your sending, then deleted or anonymized.",
        "Suppression entries are kept while your account is active, to protect recipients who bounced, complained, or unsubscribed from receiving further email.",
        "Billing records are kept as long as tax and accounting law requires.",
        "Server logs containing IP addresses are kept for a short period for security and debugging, then deleted.",
      ],
    },
    {
      title: "Deleting your account",
      body: [
        `You can delete API keys, domains, webhook endpoints, and suppression entries from the dashboard at any time. To delete your account and its data, email ${CONTACT_EMAIL} from your account address. We will delete your data within 30 days, except for records we must keep for legal or billing reasons, and we will confirm when it is done.`,
      ],
    },
    {
      title: "Security",
      body: [
        "All traffic is encrypted in transit with TLS, and data is encrypted at rest. API keys are scoped, shown once, and revocable. Webhook payloads are signed with HMAC-SHA256 so you can verify they came from us. Access to production systems is restricted to the people who operate the service. If we learn of a breach that affects your data, we will notify you without undue delay.",
      ],
    },
    {
      title: "Your rights",
      body: [
        "Depending on where you live, you may have the right to:",
      ],
      points: [
        "Access the personal data we hold about you and get a copy of it.",
        "Correct data that is inaccurate.",
        "Delete your data.",
        "Export your data in a portable format.",
        "Restrict or object to certain processing.",
        "Withdraw consent where processing is based on consent.",
        "Complain to your local data protection authority if you believe we have mishandled your data.",
      ],
    },
    {
      title: "Exercising your rights",
      body: [
        `Email ${CONTACT_EMAIL} with your request and we will respond within 30 days. We may ask you to verify that you control the account before acting. We do not discriminate against you for exercising any of these rights.`,
      ],
    },
    {
      title: "Children",
      body: [
        "Retransmit is a developer tool for businesses and is not directed at children. We do not knowingly collect personal data from anyone under 16. If you believe a child has created an account, contact us and we will delete it.",
      ],
    },
    {
      title: "Changes to this policy",
      body: [
        "If this policy changes in a way that matters, we will update the date above and note the change on this page. For significant changes we will also notify you by email. Continued use of the service after a change means you accept the updated policy.",
      ],
    },
    {
      title: "Contact",
      body: [
        `Questions, requests, and complaints about privacy go to ${CONTACT_EMAIL}. We read everything and a person will reply.`,
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
        "You need an account to use the service, created by signing in with Google, GitHub, or a magic link sent to your email address. You are responsible for what happens under your account and for keeping your API keys secret. Tell us right away if you believe a key or your account is compromised.",
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
