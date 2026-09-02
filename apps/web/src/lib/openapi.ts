import { siteConfig } from "@/lib/site";

/* OpenAPI 3.1 description of the Retransmit REST API, published at
   /openapi.json so agents can discover the API surface from the
   marketing domain. Kept in sync by hand with the Hono routes in
   apps/api/src/server; the shapes below mirror those handlers exactly. */

const API_BASE_URL = "https://api.retransmit.dev";

const EMAIL_STATUSES = [
  "queued",
  "scheduled",
  "sent",
  "delivery_delayed",
  "delivered",
  "opened",
  "clicked",
  "canceled",
  "suppressed",
  "rejected",
  "failed",
  "bounced",
  "complained",
] as const;

const EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.rejected",
  "email.failed",
] as const;

const ERROR_CODES = [
  "invalid_json",
  "validation_error",
  "unauthorized",
  "domain_not_found",
  "domain_not_verified",
  "not_found",
  "internal_error",
] as const;

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const addressListSchema = {
  description:
    'One recipient or up to 50, each as a bare address or "Name <address@example.com>".',
  oneOf: [
    { type: "string" },
    {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 50,
    },
  ],
} as const;

export const OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Retransmit API",
    version: "1.0.0",
    summary: siteConfig.tagline,
    description:
      "Transactional email API. Queue single emails or batches of up to 10,000, then track delivery through per-email event logs and signed webhooks. Authenticate every /v1 request with an API key from the dashboard. Errors are always JSON with a stable `error.code`. Self-hosted deployments serve this same API at their own base URL.",
    contact: { name: siteConfig.name, url: siteConfig.url },
    license: {
      name: "AGPL-3.0",
      identifier: "AGPL-3.0-only",
    },
  },
  externalDocs: {
    description: "Retransmit documentation",
    url: siteConfig.links.docs,
  },
  servers: [{ url: API_BASE_URL, description: "Retransmit Cloud" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Emails", description: "Send email and read delivery state." },
    { name: "Service", description: "Unauthenticated service endpoints." },
  ],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        tags: ["Service"],
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "Service is up.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: { status: { type: "string", const: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/v1/emails": {
      post: {
        operationId: "sendEmail",
        tags: ["Emails"],
        summary: "Queue one email",
        description:
          "Returns 202 immediately; a rate-aware worker performs the send. Poll GET /v1/emails/{id} or subscribe to webhooks for the outcome. The `from` domain must be registered and verified on your account.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SendEmailRequest" },
            },
          },
        },
        responses: {
          "202": {
            description: "Email accepted and queued.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QueuedEmail" },
              },
            },
          },
          "400": errorResponse("Body is not valid JSON (`invalid_json`)."),
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "403": errorResponse(
            "Sender domain not registered (`domain_not_found`) or not verified (`domain_not_verified`).",
          ),
          "422": errorResponse("Schema validation failed (`validation_error`)."),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
    "/v1/emails/{id}": {
      get: {
        operationId: "getEmail",
        tags: ["Emails"],
        summary: "Get one email with its event history",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Email id, e.g. `em_...`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The email and its events, oldest first.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Email" },
              },
            },
          },
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "404": errorResponse("No email with this id on your account."),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
    "/v1/emails/batch": {
      post: {
        operationId: "sendEmailBatch",
        tags: ["Emails"],
        summary: "Queue up to 10,000 emails in one request",
        description:
          "All emails are stored as `queued` and drained by the worker at your account's sending rate. Every message still gets its own id, log entry, and webhook events. Track progress with GET /v1/emails/batch/{id}.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["emails"],
                properties: {
                  emails: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SendEmailRequest" },
                    minItems: 1,
                    maxItems: 10000,
                  },
                },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Batch accepted and queued.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QueuedBatch" },
              },
            },
          },
          "400": errorResponse("Body is not valid JSON (`invalid_json`)."),
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "403": errorResponse(
            "A sender domain is not registered (`domain_not_found`) or not verified (`domain_not_verified`).",
          ),
          "422": errorResponse("Schema validation failed (`validation_error`)."),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
    "/v1/emails/batch/{id}": {
      get: {
        operationId: "getEmailBatch",
        tags: ["Emails"],
        summary: "Get batch progress",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Batch id, e.g. `bt_...`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Per-status counts for the batch so far.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchProgress" },
              },
            },
          },
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "404": errorResponse("No batch with this id on your account."),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "API key from the dashboard, sent as `Authorization: Bearer rt_...`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        description:
          "Every non-2xx response has this shape. `error.code` is stable and machine-matchable; `error.message` explains how to fix the request.",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", enum: [...ERROR_CODES] },
              message: { type: "string" },
            },
          },
        },
      },
      SendEmailRequest: {
        type: "object",
        required: ["from", "to", "subject"],
        description: "Provide `html`, `text`, or both.",
        properties: {
          from: {
            type: "string",
            description:
              'Sender, as a bare address or "Name <address@example.com>". The domain must be verified on your account.',
          },
          to: addressListSchema,
          cc: addressListSchema,
          bcc: addressListSchema,
          reply_to: addressListSchema,
          subject: { type: "string", minLength: 1, maxLength: 998 },
          html: { type: "string", maxLength: 1000000 },
          text: { type: "string", maxLength: 1000000 },
        },
      },
      QueuedEmail: {
        type: "object",
        required: ["id", "status", "created_at"],
        properties: {
          id: { type: "string" },
          status: { type: "string", const: "queued" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      QueuedBatch: {
        type: "object",
        required: ["id", "total", "status", "created_at"],
        properties: {
          id: { type: "string" },
          total: { type: "integer" },
          status: { type: "string", const: "queued" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      BatchProgress: {
        type: "object",
        required: ["id", "total", "processed", "counts", "created_at"],
        properties: {
          id: { type: "string" },
          total: { type: "integer" },
          processed: {
            type: "integer",
            description:
              "Emails that have left the queue (any status other than queued or scheduled).",
          },
          counts: {
            type: "object",
            description: "Email count per status.",
            additionalProperties: { type: "integer" },
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Email: {
        type: "object",
        required: ["id", "from", "to", "subject", "status", "created_at", "events"],
        properties: {
          id: { type: "string" },
          batch_id: { type: ["string", "null"] },
          from: { type: "string" },
          to: { type: "array", items: { type: "string" } },
          cc: { type: ["array", "null"], items: { type: "string" } },
          bcc: { type: ["array", "null"], items: { type: "string" } },
          reply_to: { type: ["array", "null"], items: { type: "string" } },
          subject: { type: "string" },
          status: { type: "string", enum: [...EMAIL_STATUSES] },
          error: {
            type: ["string", "null"],
            description: "Failure detail when status is a failure state.",
          },
          created_at: { type: "string", format: "date-time" },
          last_event_at: { type: ["string", "null"], format: "date-time" },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailEvent" },
          },
        },
      },
      EmailEvent: {
        type: "object",
        required: ["type", "created_at"],
        properties: {
          type: { type: "string", enum: [...EVENT_TYPES] },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
} as const;
