# retransmit.dev

Node.js SDK for the [Retransmit](https://retransmit.dev) messaging API. Send email and SMS through one typed client; WhatsApp support is coming soon. Zero dependencies, works on Node 18+ and edge runtimes with `fetch`.

| Channel | SDK namespace | Availability |
| --- | --- | --- |
| Email | `retransmit.emails` | Available |
| SMS | `retransmit.sms` | Available |
| WhatsApp | `retransmit.whatsapp` | Coming soon; not included in the current release |

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

WhatsApp is the next planned channel. The intended SDK namespace is
`retransmit.whatsapp`, but it is deliberately not exported yet because the
production endpoint and request types are still being finalized. This keeps
the current SDK honest while reserving a consistent channel-based API shape.

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
