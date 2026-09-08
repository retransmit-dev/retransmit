import type { Route } from "next";

/* Privacy policy, terms of service, SMS policy, and data deletion, as data. The HTML pages and the
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
  updatedLabel: "September 6, 2026",
  intro:
    "This policy explains what Retransmit collects, why we collect it, how long we keep it, who we share it with, and what you can do about it. It covers the retransmit.dev website, the dashboard, and the hosted API, across every channel we offer: email, SMS, and WhatsApp. If you self-host Retransmit, this policy does not apply to your instance; you control that data.",
  sections: [
    {
      title: "Who we are",
      body: [
        `Retransmit is a messaging API and dashboard for email, SMS, and WhatsApp at retransmit.dev, operated by Logesta Labs LLC. In this policy, "we" and "us" mean Logesta Labs LLC. We are the data controller for your account data and the information described below. For anything in this policy, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "What we collect",
      body: ["We collect only what the service needs to run:"],
      points: [
        "Account data: your name, email address, and profile picture, provided by the sign-in provider you choose (Google or GitHub), or just your email address if you sign in with a magic link, plus the account settings you configure in the dashboard.",
        "Email data: the emails you send through the API, including recipient addresses, subject lines, content, attachments, and delivery events such as sends, deliveries, bounces, and complaints.",
        "SMS data: the text messages you send through the API, including recipient phone numbers, sender ids, message text, and delivery receipts.",
        "WhatsApp data: the WhatsApp Business number you connect, the messages you send from it, the replies people send to it, your message templates, and the credentials Meta issues so we can act on your behalf. The WhatsApp Business Platform section below lists every item.",
        "Sending configuration: your verified domains, connected phone numbers, API keys, webhook endpoints, and suppression lists.",
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
      title: "WhatsApp Business Platform",
      body: [
        "You can connect a WhatsApp Business number to Retransmit and send and receive WhatsApp messages through it. The connection runs through Meta's Embedded Signup, a Facebook Login for Business flow that Meta hosts inside our dashboard. Retransmit is registered with Meta as a Tech Provider. The Meta app you connect to belongs to Logesta Labs LLC, which is why Meta's dialog shows that name. Here is exactly what we receive from Meta and what we do with it.",
      ],
      points: [
        "What we receive when you connect: the id of your WhatsApp Business Account, the id and phone number of the business number you chose, the display name Meta verified for it, its quality rating, and a business integration access token scoped to that WhatsApp Business Account. We request the whatsapp_business_messaging and whatsapp_business_management permissions and no others. We do not receive your personal Facebook profile, friends, pages, ad accounts, or anything outside the WhatsApp Business Account you chose.",
        "How we use the token: to register your number with the WhatsApp Cloud API, to send the messages you ask us to send from it, to subscribe our app to your account's webhooks so delivery statuses and replies reach you, to create, sync, and delete message templates on your account, and to refresh the number's display name and quality rating. We use it for nothing else.",
        "Messages you send: we store the recipient number, the message type and text, the template name and parameters, links to any media, and each delivery status Meta reports (sent, delivered, read, failed) together with Meta's status notification. Media is sent by link. We do not host it; Meta fetches it from the URL you provide.",
        "Messages people send to your number: Meta forwards them to us through a webhook. We store the sender's phone number, the profile name their WhatsApp shares, the message type, the text or caption, the message object as Meta sent it, and the time it was received. We forward each message to the webhook endpoints you configured so you can reply. We do not download media files from inbound messages.",
        "Templates: the name, language, category, header, body, footer, buttons, example values, and review status of each template you create in Retransmit or sync from WhatsApp Manager.",
        "How we store it: the access token and the number's two-step verification PIN are encrypted at rest with AES-256-GCM using a key held outside the database, on top of the disk encryption that covers everything else. Neither is ever shown in the dashboard or returned by the API. Only members of your organization with the admin role can connect or disconnect a number.",
        "How we share it: with Meta, to deliver your messages and manage your account, and with the infrastructure providers that host the service on our behalf. We do not sell it, use it for advertising, or use it to train models. We do not share it with anyone else.",
        "Disconnecting: remove a number from the WhatsApp page in the dashboard. We delete the stored token and PIN right away and unsubscribe our app from your WhatsApp Business Account when no other connected number shares it. Your message logs, templates, and delivery events stay in your account so you can audit past sending, and are deleted with the account. You can also remove Retransmit from your WhatsApp Business Account at any time in Meta Business Suite under Business settings, which revokes our access on Meta's side immediately.",
      ],
    },
    {
      title: "Meta Platform data disclosure",
      body: [
        "Retransmit's use of data received from Meta follows the Meta Platform Terms, the Meta Developer Policies, the WhatsApp Business Terms of Service, and the WhatsApp Business Messaging Policy. We use Platform Data only to provide the WhatsApp features described above, on behalf of the business that connected the account. When you connect a number, you share the data listed above with Retransmit, and the messages you send and receive pass through Meta's servers under Meta's own privacy policy.",
        "You remain responsible for the content of your messages, for opening conversations with approved templates, and for holding the opt-in that WhatsApp requires before a business messages someone. If Meta asks us to delete Platform Data, or if a person asks to delete data that relates to them, we delete it. Humans at Retransmit do not read your messages except with your permission, for support at your request, for security and abuse prevention, or where the law requires it.",
      ],
    },
    {
      title: "How we use your data",
      body: [
        "We use your data to operate the service: to deliver your emails, SMS, and WhatsApp messages, pass replies back to you, show you logs and analytics for your own sending, bill your prepaid balance, prevent spam and abuse, secure the platform, and respond to support requests.",
        "We do not sell your data. We do not serve ads. We do not use the content of your messages for advertising or to train models.",
        "Where the GDPR applies, our legal bases are: performance of our contract with you (running the service you signed up for), legitimate interests (securing the platform and preventing abuse), legal obligation (tax and accounting records), and consent where we ask for it.",
      ],
    },
    {
      title: "Your recipients' data",
      body: [
        "When you send email, SMS, or WhatsApp messages through Retransmit, you give us the addresses, phone numbers, and message content of people who are not our customers, and when they reply on WhatsApp, their replies. For that data you are the controller and we are your processor: we process it only to deliver your messages, record delivery events, pass replies back to you, and maintain your suppression list, on your instructions. You are responsible for having a lawful basis to contact your recipients.",
        `If you received an email or message sent through Retransmit and have questions about it, contact the sender first; they control that data. You can also reach us at ${CONTACT_EMAIL} and we will help route your request.`,
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
        "Amazon Web Services: our infrastructure runs on AWS data centers in the European Union and the United States. Your emails are delivered through Amazon SES, email attachments are stored in Amazon S3, and some SMS is delivered through AWS End User Messaging.",
        "Meta Platforms: when you connect a WhatsApp Business number, Meta receives the messages you send, delivers replies and status updates to us, and holds the account, number, and template data described in the WhatsApp Business Platform section. Meta processes it under the WhatsApp Business Terms and its own privacy policy.",
        "SMS carriers: the mobile carriers and gateways that deliver your SMS receive the recipient number, sender id, and message text. Which one carries a message depends on the destination; today they are MTN Cameroon, Orange Cameroon, and AWS End User Messaging.",
        "Slane Analytics: analytics.slane.io receives website page URLs, referrers, browser window widths, random visitor identifiers, and conversion event names and placements so we can measure website usage.",
        "Payment providers: when you buy credits, your payment details go directly to the payment provider. We never see or store card numbers; we receive only confirmation that a payment succeeded.",
        "Authorities: we disclose data to law enforcement or regulators only when the law requires it, and we push back on requests that are overbroad.",
      ],
    },
    {
      title: "International transfers",
      body: [
        "Our infrastructure runs in the European Union and the United States, so your data may be processed in either region. Meta and the SMS carriers process the messages they deliver in their own regions under their own terms. Where data moves out of the European Economic Area, we rely on safeguards such as the European Commission's Standard Contractual Clauses with our providers.",
      ],
    },
    {
      title: "Retention and deletion",
      body: [
        "We keep data only as long as it serves a purpose:",
      ],
      points: [
        "Account data is kept while your account is active and deleted when your account is deleted.",
        "Message logs and delivery events for email, SMS, and WhatsApp, including replies to your WhatsApp number, are kept while your account is active so you can audit your sending, and deleted when your account is deleted. Email attachments are deleted 30 days after upload.",
        "WhatsApp access tokens and PINs are deleted the moment you disconnect the number.",
        "Suppression entries are kept while your account is active, to protect recipients who bounced, complained, or unsubscribed from receiving further email.",
        "Billing records are kept as long as tax and accounting law requires.",
        "Server logs containing IP addresses are kept for a short period for security and debugging, then deleted.",
      ],
    },
    {
      title: "Deleting your account",
      body: [
        `You can delete API keys, domains, webhook endpoints, suppression entries, and connected WhatsApp numbers from the dashboard at any time. To delete your account and its data, including everything we received from Meta, email ${CONTACT_EMAIL} from your account address. We will delete your data within 30 days, except for records we must keep for legal or billing reasons, and we will confirm when it is done.`,
        "If you connected a WhatsApp number, you can also remove Retransmit from your WhatsApp Business Account in Meta Business Suite. That revokes our access on Meta's side even before we delete our copy.",
        "Step by step instructions for every case are on the data deletion page at retransmit.dev/data-deletion.",
      ],
    },
    {
      title: "Security",
      body: [
        "All traffic is encrypted in transit with TLS, and data is encrypted at rest. WhatsApp access tokens and PINs carry a second layer of AES-256-GCM encryption. API keys are scoped, shown once, and revocable. Webhook payloads we send are signed with HMAC-SHA256 so you can verify they came from us, and webhooks we receive from Meta are checked against Meta's signature before we process them. Access to production systems is restricted to the people who operate the service. If we learn of a breach that affects your data, we will notify you without undue delay.",
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
  updatedLabel: "September 8, 2026",
  intro:
    "These terms govern your use of the Retransmit hosted service: the retransmit.dev website, the dashboard, and the hosted API. By creating an account or sending a message through the service, you agree to them. The self-hosted software is licensed separately under AGPL-3.0 (SDK under MIT) and is not covered by these terms.",
  sections: [
    {
      title: "The service",
      body: [
        "Retransmit is a messaging API for email, SMS, and WhatsApp. You bring your recipients and your content; we queue, deliver, and report on your messages. Which mail provider, mobile carrier, or platform delivers a given message depends on the channel and the destination country. We may improve or change features over time.",
        "You send to your own recipients under your own brand. For the personal data in your messages you are the controller and we are your processor, as set out in the privacy policy.",
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
        "These rules apply to every channel. You agree to:",
      ],
      points: [
        "Send only to recipients who have a relationship with you or have agreed to receive your messages on that channel, and keep a record of that agreement.",
        "Identify yourself accurately. Do not disguise who is sending, forge headers or sender ids, or impersonate another business or person.",
        "Comply with applicable law, including anti-spam and privacy laws such as CAN-SPAM, the TCPA, and the GDPR, and with the rules of the carriers and platforms that carry your messages.",
        "Honor opt-out requests promptly and not send to a recipient we have suppressed.",
        "Not send unlawful, deceptive, or malicious content, including phishing, malware, and fraud.",
        "Not resell raw access to the service to third parties whose sending you cannot vouch for, and not probe, overload, or interfere with the service.",
      ],
    },
    {
      title: "Sending email",
      body: [
        "Email adds a few rules of its own:",
      ],
      points: [
        "Every marketing email needs a working unsubscribe link, and we add one-click unsubscribe headers so mailbox providers can offer their own.",
        "We keep a suppression list per account. Addresses that bounce, complain, or unsubscribe go on it, and we refuse later sends to them.",
        "Send from a domain you have verified in the dashboard.",
      ],
    },
    {
      title: "Sending SMS",
      body: [
        "SMS reaches people on their phones, and the carriers that deliver it hold senders to a higher bar than email. Consent to receive SMS is separate from consent to receive email; agreeing to one is never agreement to the other. When you send SMS through Retransmit you agree to:",
      ],
      points: [
        "Collect prior express consent from each recipient to receive text messages at that specific number, before you send anything, and keep a record of when and how you collected it. Show it to us on request.",
        "Tell people at the moment they opt in who will be messaging them, what the messages will be about, roughly how often they will arrive, that message and data rates may apply, and how to stop.",
        "Never send to purchased, rented, scraped, or otherwise borrowed lists, and never to a number that reached you through someone else's opt-in.",
        "Identify your business in your messages, so a recipient can tell who is contacting them.",
        "Honor every opt-out, by whichever route it reaches you: a STOP reply, a message to you directly, or one we pass on to you. Do not send to that number again unless the person opts back in. Where you send from a phone number, the carrier network blocks opted-out numbers as well, but the obligation is yours either way.",
        "Give opt-out instructions that work on the route you send from, in the first message of a conversation and in any recurring or promotional message. \"Reply STOP\" belongs only on messages sent from a phone number; an alphanumeric sender id cannot receive replies, so point people at a link, an account setting, or a contact you monitor instead.",
        "Not send content in restricted categories: sexual content, hate speech, alcohol, firearms, tobacco, cannabis, illegal drugs, gambling, high-risk lending, and anything else a carrier or regulator prohibits in the destination country.",
        "Use only sender ids we approved for the destination country, and respect local rules on quiet hours and registration.",
      ],
    },
    {
      title: "Sending WhatsApp",
      body: [
        "WhatsApp messages travel over Meta's WhatsApp Business Platform and are subject to Meta's rules as well as ours. You agree to follow the WhatsApp Business Messaging Policy and the WhatsApp Business Terms of Service, to hold the opt-in WhatsApp requires before a business messages someone, to open conversations with an approved template, and to reply free-form only inside the 24 hour service window. Meta may reject templates, rate limit your number, or lower its quality rating, and those decisions are Meta's, not ours.",
      ],
    },
    {
      title: "Credits and payment",
      body: [
        "The hosted service runs on prepaid credits. Credits are consumed per message sent, at a rate that depends on the channel and the destination, and do not expire while your account is in good standing. Prices are shown before you pay. If something goes wrong with a purchase, contact us and we will sort it out.",
      ],
    },
    {
      title: "Suspension and termination",
      body: [
        "We may suspend or close an account that violates these terms, generates complaints or opt-outs at a rate that puts our routes at risk, harms deliverability for other customers, or creates legal risk. We may also stop specific sending when a carrier, mail provider, platform, or regulator asks us to. Where reasonable, we will warn you first. You can stop using the service and ask us to delete your account at any time.",
      ],
    },
    {
      title: "Disclaimers",
      body: [
        "The service is provided as is. Delivery depends on third parties, including recipient mail servers, mobile carriers, and Meta, and we cannot guarantee that every message will be delivered, delivered on time, or delivered at the price quoted for a route that changes. To the maximum extent permitted by law, we disclaim all implied warranties.",
      ],
    },
    {
      title: "Limitation of liability",
      body: [
        "To the maximum extent permitted by law, Retransmit's total liability for any claim arising out of the service is limited to the amount you paid us in the twelve months before the claim. We are not liable for indirect or consequential damages, or for lost profits or data.",
      ],
    },
    {
      title: "Indemnity",
      body: [
        "You are responsible for your messages and your recipients. If someone brings a claim against us because of what you sent, who you sent it to, or the consent you did or did not hold, you will cover our reasonable costs in defending it.",
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

export const DATA_DELETION: LegalDoc = {
  href: "/data-deletion",
  title: "Data deletion",
  updatedLabel: "September 6, 2026",
  intro:
    "How to delete the data Retransmit holds about you. This page covers three situations: you connected a WhatsApp Business number through Meta, you have a Retransmit account, or you received a message that was sent through Retransmit. Retransmit is operated by Logesta Labs LLC, and every request below goes to a person who will confirm when it is done.",
  sections: [
    {
      title: "If you connected a WhatsApp Business number",
      body: [
        "Connecting a number through Meta's Embedded Signup gives Retransmit an access token for your WhatsApp Business Account, your business number and its verified name, and the messages sent from and received by that number. To remove it:",
      ],
      points: [
        "Open the dashboard at app.retransmit.dev, go to WhatsApp, and choose Disconnect on the number. This deletes the stored access token and PIN immediately and unsubscribes Retransmit from your WhatsApp Business Account when no other connected number shares it. Only an organization admin can do this.",
        "Optionally, also remove Retransmit from the Meta side. In Meta Business Suite, open Business settings and remove the connected app named Retransmit, listed under Logesta Labs LLC. This revokes our access even if you never opened our dashboard.",
        `Message logs, templates, and delivery events for the number stay in your account so you can audit past sending. To delete them too, email ${CONTACT_EMAIL} from your account address and ask for the WhatsApp data, or for the whole account, to be deleted. We complete the request within 30 days and confirm by email.`,
      ],
    },
    {
      title: "If you have a Retransmit account",
      body: [
        "You can delete API keys, verified domains, webhook endpoints, suppression entries, and connected WhatsApp numbers from the dashboard at any time, and each deletion takes effect immediately.",
        `To delete your account and everything in it, including your profile from Google or GitHub sign-in, your message logs across email, SMS, and WhatsApp, and everything we received from Meta, email ${CONTACT_EMAIL} from the address on your account. We delete the data within 30 days and confirm when it is done. We keep only the billing records that tax and accounting law requires us to keep.`,
      ],
    },
    {
      title: "If you received a message sent through Retransmit",
      body: [
        "Businesses use Retransmit to send email, SMS, and WhatsApp messages to their own customers. The business that contacted you controls your address, phone number, and the content of those messages, and any WhatsApp reply you sent to them. Ask that business first; it can delete your data from its Retransmit account.",
        `If you cannot reach the sender, or you want us to act directly, email ${CONTACT_EMAIL} with the phone number or email address that received the message. We will identify the records, delete them or route the request to the sender, and tell you the outcome within 30 days. We also honor deletion requests that Meta forwards to us for WhatsApp data.`,
      ],
    },
    {
      title: "What deletion covers",
      body: [
        "A completed request removes the data from our production database and from the Amazon Web Services infrastructure that hosts it. Backups age out on their own schedule within a short period after that. We do not keep copies for advertising, training, or any purpose other than the ones in the privacy policy.",
      ],
    },
    {
      title: "Contact",
      body: [
        `Deletion requests and questions about them go to ${CONTACT_EMAIL}. Include the account email or phone number the request concerns so we can find the records and verify that you are entitled to ask.`,
      ],
    },
  ],
};

export const SMS_POLICY: LegalDoc = {
  href: "/sms-policy",
  title: "SMS policy",
  updatedLabel: "September 8, 2026",
  intro:
    "How consent and opt-out work for SMS sent through Retransmit. Retransmit is a messaging platform operated by Logesta Labs LLC: businesses send text messages to their own customers through our API, so the business that messaged you chose to contact you and wrote the message. This page explains how to stop those messages, and what we require of the businesses that send them.",
  sections: [
    {
      title: "Stopping messages",
      body: [
        "How you stop messages depends on what your phone shows as the sender.",
        "If the message came from a phone number, reply STOP to it. We also accept STOPALL, UNSUBSCRIBE, CANCEL, END, and QUIT, in upper or lower case. Delivery to your number stops straight away, opting out is free, and it holds until you opt back in. Reply START or UNSTOP to the same number if you want the messages again.",
        `If the message showed a name instead of a number, such as a brand or a shop, that is an alphanumeric sender id. Those are one-way: your phone cannot send anything back, and a reply reaches nobody. To stop them, contact the business through the account or address you have with them, or email us at ${CONTACT_EMAIL} and we will identify the sender, record your request against your number, and pass it on.`,
        "Every message should tell you how to stop it, in the form that works for the route it came on. If one does not, that breaks our terms of service and we want to hear about it.",
      ],
    },
    {
      title: "Getting help",
      body: [
        "Reply HELP to a message that came from a phone number and you will get a reply naming the business that contacted you and how to reach them.",
        `An alphanumeric sender id cannot answer HELP, for the same reason it cannot answer STOP. Email ${CONTACT_EMAIL} instead. Tell us the number that received the message, the name it showed, and roughly when it arrived, and we will identify the sender and act on your request.`,
      ],
    },
    {
      title: "Message frequency and rates",
      body: [
        "Message frequency depends on the business that messages you and on what you signed up for. A verification code arrives when you ask for one; an order update arrives when your order changes.",
        "Message and data rates may apply. Retransmit does not charge you for messages you receive. Your mobile carrier may, under your own plan.",
      ],
    },
    {
      title: "How consent works",
      body: [
        "Businesses may only message a number that gave them prior express consent to receive text messages at that number. Consent to SMS is separate from consent to email, and it is not transferable: a number collected under one business's opt-in cannot be messaged by another. Purchased, rented, and scraped lists are not consent, and are banned by our terms of service.",
        "A valid opt-in is a deliberate act by the person who owns the number. In practice that means one of:",
      ],
      points: [
        "Typing their number into a web form or checking an unchecked box next to a clear description of the messages they will get.",
        "Texting a keyword to the sender's number.",
        "Asking for a verification code as part of signing in or confirming an action.",
        "Agreeing in person or on a call, with the business keeping a written record of it.",
      ],
    },
    {
      title: "What businesses must disclose at opt-in",
      body: [
        "At the moment consent is collected, the business has to tell the person who will be messaging them, what the messages will be about, roughly how often they arrive, that message and data rates may apply, and how to stop, described in a way that works on the route they send from. Our terms of service require this of every account that sends SMS.",
      ],
    },
    {
      title: "What businesses send",
      body: [
        "SMS on Retransmit is for transactional and consented messages. Typical messages look like this:",
      ],
      points: [
        "Verification: \"Acme: 481920 is your verification code. It expires in 10 minutes. Do not share it with anyone.\"",
        "Order update, sent from a phone number: \"Acme: your order #1043 is out for delivery and arrives today. Reply STOP to opt out.\"",
        "Appointment reminder, sent from a sender id: \"Acme: reminder of your appointment on Tuesday at 14:00. To stop these reminders, change your preferences at acme.com/account.\"",
        "Security alert: \"Acme: a new sign in to your account from a new device. If this was not you, contact support right away.\"",
      ],
    },
    {
      title: "Restricted content",
      body: [
        "Businesses may not send sexual content, hate speech, or messages about alcohol, firearms, tobacco, cannabis, illegal drugs, gambling, or high-risk lending through Retransmit, along with anything else a carrier or regulator prohibits in the destination country. Accounts that do are suspended.",
      ],
    },
    {
      title: "How we enforce this",
      body: [
        "Sender ids are reviewed and approved per country before an account can use them, so a business cannot put someone else's brand on a handset. We monitor delivery, failure, and complaint rates per account, and we suspend accounts whose consent does not hold up or that a carrier or regulator flags to us.",
        "Where we send from a phone number, opt-out keywords are handled by the carrier network: a number that replies STOP is added to an opt-out list and later messages to it are blocked, whether or not the sender acts on it.",
        "Where we send from an alphanumeric sender id, no reply can reach the sender or us, so opt-outs arrive by the routes above. We record every one we receive against the number it concerns and pass it to the sender, who must not message that number again. Ignoring one is grounds for suspension.",
      ],
    },
    {
      title: "If you got a message you did not ask for",
      body: [
        `Reply STOP if the message came from a phone number; that stops it immediately. Either way, email ${CONTACT_EMAIL} with the number that received the message, the sender id or business name it showed, and the date. We will identify the account, investigate, and suspend it if the consent it claims does not hold. Tell us if you want your number deleted as well and we will do that too.`,
      ],
    },
    {
      title: "For businesses sending SMS",
      body: [
        "The binding rules are in the Sending SMS section of our terms of service. In short: hold and record consent per number, disclose at opt-in, identify yourself in the message, stay out of restricted categories, and use only the sender ids we approved for that country.",
        "Give opt-out instructions that actually work on the route you send from. \"Reply STOP\" belongs only on messages sent from a phone number. On an alphanumeric sender id, point people at a link, an account setting, or a contact you monitor, because a reply to a one-way sender reaches nobody. Telling someone to reply STOP where no reply can arrive breaks these rules on its own.",
        "Honor every opt-out you receive, by whichever route it reaches you, including the ones we pass on to you. Keeping your own consent and opt-out records is your obligation, not ours.",
      ],
    },
    {
      title: "Contact",
      body: [
        `Questions, opt-out requests, and complaints about SMS go to ${CONTACT_EMAIL}. A person reads them and will reply.`,
      ],
    },
  ],
};

export const LEGAL_DOCS = [
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  SMS_POLICY,
  DATA_DELETION,
] as const;
