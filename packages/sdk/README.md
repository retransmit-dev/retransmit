# retransmit.dev

Node.js SDK for the [Retransmit](https://retransmit.dev) messaging API. Send email, SMS, and WhatsApp through one typed client. Zero dependencies, works on Node 18+ and edge runtimes with `fetch`.

| Channel | SDK namespace | Availability |
| --- | --- | --- |
| Email | `retransmit.emails` | Available |
| SMS | `retransmit.sms` | Available |
| WhatsApp | `retransmit.whatsapp` | Available |

## Install

```bash
npm install retransmit.dev
# or
pnpm add retransmit.dev
```

## Create a client

Grab an API key from your Retransmit dashboard, then:

```ts
import { Retransmit } from "retransmit.dev";

const retransmit = new Retransmit("rt_xxxxxxxxxxxx");
// or set RETRANSMIT_API_KEY and call `new Retransmit()`
```

## Email

```ts
const { data, error } = await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Hello from Retransmit",
  html: "<p>It works!</p>",
});

if (error) {
  console.error(error.code, error.message);
} else {
  console.log(data.id); // em_xxxxxxxxxxxx
}
```

Emails are queued and sent asynchronously. Check the outcome later:

```ts
const { data } = await retransmit.emails.get("em_xxxxxxxxxxxx");
console.log(data?.status); // "delivered"
```

## SMS

Use international E.164 phone numbers. A single request can contain up to 50
recipients, all in the same country.

```ts
const { data, error } = await retransmit.sms.send({
  from: "Acme",
  to: "+237670000000",
  text: "Your verification code is 482913",
});

if (error) {
  console.error(error.code, error.message);
} else {
  console.log(data.id, data.country, data.segments);
}
```

SMS messages are also asynchronous:

```ts
const { data } = await retransmit.sms.get("sms_xxxxxxxxxxxx");
console.log(data?.status); // "sent" | "delivered" | "undelivered" | ...
```

## Email batches

Send up to 10,000 emails in one request:

```ts
const { data: batch } = await retransmit.batch.send([
  { from: "Acme <hello@yourdomain.com>", to: "a@example.com", subject: "Hi", text: "Hello A" },
  { from: "Acme <hello@yourdomain.com>", to: "b@example.com", subject: "Hi", text: "Hello B" },
]);

const { data: progress } = await retransmit.batch.get(batch!.id);
console.log(progress?.processed, "/", progress?.total, progress?.counts);
```

## WhatsApp

Connect your WhatsApp Business number in the dashboard first. One recipient
per request, in E.164 format. Start a conversation with an approved template;
once the recipient replies you can send free-form text and media for 24 hours.

```ts
const { data, error } = await retransmit.whatsapp.send({
  to: "+237670000000",
  type: "template",
  template: {
    name: "verification_code",
    language: "en_US",
    components: [{ type: "body", parameters: [{ type: "text", text: "482913" }] }],
  },
});

// Inside the 24-hour window:
await retransmit.whatsapp.send({ to: "+237670000000", text: "Anything else we can help with?" });
```

Check the outcome, including `read` receipts:

```ts
const { data } = await retransmit.whatsapp.get("wa_xxxxxxxxxxxx");
console.log(data?.status); // "sent" | "delivered" | "read" | "failed"
```

Replies from recipients reach you as `whatsapp.received` webhooks.

## Error handling

Methods never throw on API errors — they return `{ data, error }`:

```ts
const { data, error } = await retransmit.sms.send(/* ... */);
if (error) {
  // error.code: "validation_error" | "no_route" | "unauthorized" | ...
}
```

Only constructing the client without an API key throws.

## Configuration

| Option | Env var | Default |
| --- | --- | --- |
| `apiKey` (first argument) | `RETRANSMIT_API_KEY` | — (required) |
| `baseUrl` | `RETRANSMIT_BASE_URL` | `https://api.retransmit.dev` |

## License

MIT
