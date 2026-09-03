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

### Tags

Attach up to 10 `{ name, value }` tags to an email to label it. Filter by
them in the dashboard or with `emails.list`. Tags come back on `emails.get`
and are never sent to the recipient.

```ts
await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Your receipt",
  html: "<p>Thanks for your order!</p>",
  tags: [
    { name: "category", value: "receipt" },
    { name: "campaign", value: "spring-2026" },
  ],
});
```

Names and values allow letters, digits, underscores and dashes, up to 256
characters each. Names must be unique within one email. Batch emails accept
the same `tags` field.

### List and filter emails

`emails.list` returns your emails newest first. Every tag you pass must match.
Combine with `status` or `batchId`, and page with `cursor`:

```ts
const { data } = await retransmit.emails.list({
  tags: [{ name: "campaign", value: "spring-2026" }],
  status: "bounced",
  limit: 100,
});

for (const email of data!.emails) {
  console.log(email.id, email.to, email.status, email.tags);
}

if (data!.has_more) {
  await retransmit.emails.list({ cursor: data!.next_cursor!, /* same filters */ });
}
```

To see which tags exist on your account, and how many emails carry each:

```ts
const { data } = await retransmit.emails.tags();
// data.tags: [{ name: "campaign", value: "spring-2026", count: 1240 }, ...]
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
