# Retransmit

## Overview

**Retransmit** is a developer-first messaging platform that provides a single API and SDK for sending **Email, SMS, WhatsApp, OTP, and other transactional communications**.

Developers should not need to create and manage separate AWS, Twilio, Meta, or other provider accounts. They integrate Retransmit once, load credit into their account, and start sending.

Retransmit manages the underlying providers, billing, routing, delivery, and infrastructure.

> **One API. One balance. Every message.**

## Problem

Sending transactional messages often requires developers to manage several independent services:

* AWS SES or another provider for email
* Twilio or local telecom providers for SMS
* Meta for WhatsApp
* Separate accounts, credentials, billing, and dashboards
* International cards or USD payments
* Different SDKs and APIs for every communication channel

This creates unnecessary operational complexity, particularly for developers and businesses in markets where access to international payment methods can be difficult.

## Product

Retransmit provides one abstraction over these communication providers.

```text
Application
     │
     ▼
Retransmit SDK / API
     │
     ├── Email
     ├── SMS
     ├── WhatsApp
     └── OTP
     │
     ▼
Retransmit Infrastructure
     │
     ├── AWS SES
     ├── Twilio
     ├── Meta
     └── Other / Local Providers
```

Retransmit owns and pays the upstream provider accounts.

Customers only interact with Retransmit.

## Developer Experience

```bash
npm install retransmit
```

```typescript
import { Retransmit } from "retransmit";

const retransmit = new Retransmit(process.env.RETRANSMIT_API_KEY);

await retransmit.email.send({
  from: "hello@example.com",
  to: "user@example.com",
  subject: "Welcome!",
  html: "<h1>Welcome!</h1>",
});
```

Eventually the same SDK supports:

```typescript
retransmit.email.send(...)
retransmit.sms.send(...)
retransmit.whatsapp.send(...)
retransmit.otp.send(...)
```

Developers use **one API key, one SDK, and one dashboard**.

## Credit Wallet

Retransmit uses a prepaid credit system.

Customers add funds to their Retransmit wallet using supported payment methods and currencies. Usage across all communication channels is deducted from the same balance.

```text
Add funds
   ↓
Retransmit Wallet
   ↓
$20 equivalent balance
   ↓
 ┌────────┬────────┬──────────┐
Email     SMS      WhatsApp
```

Where possible, customers should be able to fund their account using **local currencies, bank transfers, cards, and mobile money** rather than requiring a USD-denominated international card.

Retransmit handles payment to AWS, Twilio, Meta, and other upstream providers.

## Business Model

Retransmit purchases communication infrastructure from upstream providers and resells it through a simpler unified platform.

```text
Customer payment
      ↓
Retransmit Credits
      ↓
Usage
      ↓
Retransmit
   ↙    ↓    ↘
 AWS  Twilio  Meta
```

Pricing includes the upstream provider cost plus Retransmit's margin.

Over time, Retransmit can improve margins through volume pricing, provider selection, direct carrier relationships, and intelligent routing.

## Initial Product

The first product will be **Retransmit Email**.

Initial capabilities:

* Transactional email API
* TypeScript SDK
* API keys
* Domain verification
* SPF / DKIM configuration
* Email logs
* Delivery status
* Bounce and complaint handling
* Webhooks
* Credit wallet
* Usage and billing dashboard

Retransmit Email will initially use established email infrastructure such as AWS SES underneath rather than operating its own mail delivery network.

## Expansion

After validating Email, Retransmit will expand into:

**SMS → WhatsApp → OTP → additional communication channels**

The long-term goal is for Retransmit to become the communication infrastructure layer developers integrate once and use everywhere.

## Product Principle

**Developers integrate Retransmit. Retransmit integrates everyone else.**
