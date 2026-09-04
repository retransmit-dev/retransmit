# Retransmit

**One API. One balance. Every message.**

Retransmit is a developer-first messaging platform: a single API for sending
**Email, SMS, WhatsApp, OTP**, and other transactional communications — without
creating AWS, Twilio, or Meta accounts yourself. The first product is
**Retransmit Email**: a transactional email API with domain verification,
delivery tracking, batches of up to 10,000 emails, and signed webhooks.

- **Website / dashboard**: [retransmit.dev](https://retransmit.dev)
- **Docs**: [docs.retransmit.dev](https://docs.retransmit.dev)
- **API**: `https://api.retransmit.dev`
- **Node.js SDK**: [`retransmit.dev` on npm](https://www.npmjs.com/package/retransmit.dev)

## Sending an email

Install the SDK:

```bash
npm install retransmit.dev
```

```ts
import { Retransmit } from "retransmit.dev";

const retransmit = new Retransmit("rt_xxxxxxxxxxxx");

const { data, error } = await retransmit.emails.send({
  from: "Acme <hello@yourdomain.com>",
  to: "user@example.com",
  subject: "Welcome!",
  html: "<h1>Welcome!</h1>",
});
```

Or call the HTTP API directly:

```bash
curl -X POST https://api.retransmit.dev/v1/emails \
  -H "Authorization: Bearer $RETRANSMIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"Acme <hello@yourdomain.com>","to":"user@example.com","subject":"Welcome!","html":"<h1>Welcome!</h1>"}'
```

See the [Quickstart](https://docs.retransmit.dev/quickstart) for API keys and
domain verification.

## Repository layout

This is a pnpm + Turborepo monorepo.

| Path | Description |
| --- | --- |
| `apps/web` | Marketing site |
| `apps/dashboard` | Customer dashboard (API keys, domains, email logs) — port 3001 |
| `apps/api` | Public HTTP API (Hono on Next.js) — port 3002 |
| `apps/docs` | Documentation site (Nextra) |
| `packages/api` | Internal tRPC API |
| `packages/auth` | Authentication (Better Auth) |
| `packages/db` | Database schema and client (Drizzle + Postgres) |
| `packages/email` | Email sending internals (SES, API keys, addresses) |
| `packages/queue` | Job queue (pg-boss): sends, retries, webhooks |
| `packages/config` | Shared TypeScript config |

The Node.js SDK ([`retransmit.dev`](https://www.npmjs.com/package/retransmit.dev) on npm) lives in its own repository: [retransmit-dev/retransmit-node](https://github.com/retransmit-dev/retransmit-node).

## Development

```bash
pnpm install
# create .env with DATABASE_URL, BETTER_AUTH_*, AWS credentials, etc.
pnpm db:push           # push schema to the database
pnpm dev               # start everything
```

### Scripts

- `pnpm dev` — start all apps in development mode
- `pnpm dev:web` / `pnpm dev:dashboard` / `pnpm dev:api` / `pnpm dev:docs` — start one app
- `pnpm build` — build all apps and packages
- `pnpm check-types` — type-check the whole workspace
- `pnpm db:push` / `pnpm db:generate` / `pnpm db:migrate` — schema management
- `pnpm db:studio` — open Drizzle Studio

### Client SDKs

SDKs live outside this repo, one repository per language:

| Language | Repository | Package |
| --- | --- | --- |
| Node.js | [retransmit-dev/retransmit-node](https://github.com/retransmit-dev/retransmit-node) | [`retransmit.dev`](https://www.npmjs.com/package/retransmit.dev) |

They are hand-written, not generated. When a change to `apps/api` is visible to clients
(new endpoint, field, status or error code), mirror it in each SDK and bump its version.
Pushing a version bump to `main` in an SDK repo publishes it.

## License

Retransmit is open source under the [GNU AGPL-3.0](LICENSE), the same license used by useSend and Plunk. The Node.js SDK ([retransmit-node](https://github.com/retransmit-dev/retransmit-node)) is published separately under MIT so client code can embed it without restrictions.
