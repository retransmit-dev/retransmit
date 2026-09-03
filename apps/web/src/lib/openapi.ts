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

const SMS_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "undelivered",
  "expired",
  "rejected",
  "failed",
] as const;

const SMS_EVENT_TYPES = [
  "sms.sent",
  "sms.delivered",
  "sms.undelivered",
  "sms.failed",
] as const;

const WHATSAPP_STATUSES = ["queued", "sent", "delivered", "read", "failed"] as const;

const WHATSAPP_MESSAGE_TYPES = ["text", "template", "image", "document"] as const;

const WHATSAPP_EVENT_TYPES = [
  "whatsapp.sent",
  "whatsapp.delivered",
  "whatsapp.read",
  "whatsapp.failed",
] as const;

const ERROR_CODES = [
  "invalid_json",
  "validation_error",
  "unauthorized",
  "domain_not_found",
  "domain_not_verified",
  "no_route",
  "no_whatsapp_account",
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
      "Transactional email, SMS and WhatsApp API. Queue single emails, batches of up to 10,000, SMS routed per destination country, or WhatsApp text, template and media messages, then track delivery through per-message event logs and signed webhooks. Authenticate every /v1 request with an API key from the dashboard. Errors are always JSON with a stable `error.code`. Self-hosted deployments serve this same API at their own base URL.",
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
    { name: "Sms", description: "Send SMS and read delivery state." },
    { name: "Whatsapp", description: "Send WhatsApp messages and read delivery state." },
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
    "/v1/sms": {
      post: {
        operationId: "sendSms",
        tags: ["Sms"],
        summary: "Queue one SMS",
        description:
          "Returns 202 immediately; a worker sends it with retries and a dead-letter queue. The destination country is detected from the number prefix and the message is routed to the cheapest configured provider for that country. All recipients in one request must be in the same country. Poll GET /v1/sms/{id} or subscribe to webhooks for the outcome.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SendSmsRequest" },
            },
          },
        },
        responses: {
          "202": {
            description: "SMS accepted and queued.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QueuedSms" },
              },
            },
          },
          "400": errorResponse("Body is not valid JSON (`invalid_json`)."),
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "422": errorResponse(
            "Schema validation failed (`validation_error`), recipients span countries (`validation_error`), or no provider is configured for the destination (`no_route`).",
          ),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
    "/v1/sms/{id}": {
      get: {
        operationId: "getSms",
        tags: ["Sms"],
        summary: "Get one SMS with its event history",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "SMS id, e.g. `sms_...`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The SMS and its events, oldest first.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Sms" },
              },
            },
          },
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "404": errorResponse("No SMS with this id on your account."),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
    "/v1/whatsapp": {
      post: {
        operationId: "sendWhatsapp",
        tags: ["Whatsapp"],
        summary: "Queue one WhatsApp message",
        description:
          "Returns 202 immediately; a worker sends it with retries and a dead-letter queue. Goes out from a WhatsApp Business number connected to your organization in the dashboard; pass `from` when you have several. One recipient per request. Business-initiated conversations must start with an approved template; free-form text and media only deliver inside the 24-hour window opened by a reply. Replies reach you as whatsapp.received webhooks. Poll GET /v1/whatsapp/{id} or subscribe to webhooks for the outcome.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SendWhatsappRequest" },
            },
          },
        },
        responses: {
          "202": {
            description: "Message accepted and queued.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QueuedWhatsapp" },
              },
            },
          },
          "400": errorResponse("Body is not valid JSON (`invalid_json`)."),
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "422": errorResponse(
            "Schema validation failed, the object required by `type` is missing, or `from` is needed to pick between several numbers (`validation_error`); or no connected WhatsApp number matches (`no_whatsapp_account`).",
          ),
          "500": errorResponse("Unexpected server error."),
        },
      },
    },
    "/v1/whatsapp/{id}": {
      get: {
        operationId: "getWhatsapp",
        tags: ["Whatsapp"],
        summary: "Get one WhatsApp message with its event history",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Message id, e.g. `wa_...`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The message and its events, oldest first.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Whatsapp" },
              },
            },
          },
          "401": errorResponse("Missing, invalid, or revoked API key."),
          "404": errorResponse("No WhatsApp message with this id on your account."),
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
      SendSmsRequest: {
        type: "object",
        required: ["to", "text"],
        properties: {
          from: {
            type: "string",
            minLength: 1,
            maxLength: 11,
            pattern: "^[a-zA-Z0-9 _-]+$",
            description:
              "Sender id shown on the device. Falls back to the routed provider's default.",
          },
          to: {
            description:
              "One recipient or up to 50, in international format, e.g. +237670000000. All recipients must be in the same country.",
            oneOf: [
              { type: "string" },
              {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 50,
              },
            ],
          },
          text: { type: "string", minLength: 1, maxLength: 1600 },
        },
      },
      QueuedSms: {
        type: "object",
        required: ["id", "status", "country", "segments", "created_at"],
        properties: {
          id: { type: "string" },
          status: { type: "string", const: "queued" },
          country: {
            type: ["string", "null"],
            description: "ISO 3166-1 alpha-2 country detected from the number prefix.",
          },
          segments: {
            type: "integer",
            description: "GSM-7 or UCS-2 segments the text splits into; billing is per segment.",
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Sms: {
        type: "object",
        required: [
          "id",
          "to",
          "text",
          "country",
          "segments",
          "status",
          "created_at",
          "events",
        ],
        properties: {
          id: { type: "string" },
          from: { type: ["string", "null"] },
          to: { type: "array", items: { type: "string" } },
          text: { type: "string" },
          country: { type: ["string", "null"] },
          segments: { type: "integer" },
          provider: {
            type: ["string", "null"],
            description: "Provider the message was routed to, set at send time.",
          },
          status: { type: "string", enum: [...SMS_STATUSES] },
          error: {
            type: ["string", "null"],
            description: "Failure detail when status is a failure state.",
          },
          created_at: { type: "string", format: "date-time" },
          last_event_at: { type: ["string", "null"], format: "date-time" },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/SmsEvent" },
          },
        },
      },
      SmsEvent: {
        type: "object",
        required: ["type", "created_at"],
        properties: {
          type: { type: "string", enum: [...SMS_EVENT_TYPES] },
          created_at: { type: "string", format: "date-time" },
        },
      },
      WhatsappTemplate: {
        type: "object",
        required: ["name", "language"],
        properties: {
          name: { type: "string", description: "Approved template name." },
          language: { type: "string", description: "Template language code, e.g. en_US." },
          components: {
            type: "array",
            items: { type: "object", additionalProperties: true },
            description: "WhatsApp `components` (header/body/button parameters), passed through verbatim.",
          },
        },
      },
      WhatsappMedia: {
        type: "object",
        required: ["link"],
        properties: {
          link: { type: "string", format: "uri", description: "Public HTTPS URL fetched at send time." },
          caption: { type: "string", maxLength: 1024 },
          filename: { type: "string", description: "Documents only: file name shown to the recipient." },
        },
      },
      SendWhatsappRequest: {
        type: "object",
        required: ["to"],
        properties: {
          from: {
            type: "string",
            description:
              "Connected number to send from, in international format. Optional when the organization has one number.",
          },
          to: {
            type: "string",
            description: "One recipient in international format, e.g. +237670000000.",
          },
          type: {
            type: "string",
            enum: [...WHATSAPP_MESSAGE_TYPES],
            default: "text",
            description: "Which content object is required: text, template, image or document.",
          },
          text: {
            type: "string",
            minLength: 1,
            maxLength: 4096,
            description: "Body for text messages; caption for media when the media object has none.",
          },
          preview_url: {
            type: "boolean",
            default: false,
            description: "Render a preview for the first link in a text message.",
          },
          template: { $ref: "#/components/schemas/WhatsappTemplate" },
          image: { $ref: "#/components/schemas/WhatsappMedia" },
          document: { $ref: "#/components/schemas/WhatsappMedia" },
        },
      },
      QueuedWhatsapp: {
        type: "object",
        required: ["id", "status", "type", "from", "country", "created_at"],
        properties: {
          id: { type: "string" },
          status: { type: "string", const: "queued" },
          type: { type: "string", enum: [...WHATSAPP_MESSAGE_TYPES] },
          from: { type: "string", description: "The connected number the message goes out from." },
          country: {
            type: ["string", "null"],
            description: "ISO 3166-1 alpha-2 country detected from the number prefix.",
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Whatsapp: {
        type: "object",
        required: [
          "id",
          "from",
          "to",
          "country",
          "type",
          "text",
          "preview_url",
          "template",
          "media",
          "provider",
          "provider_message_id",
          "status",
          "error",
          "created_at",
          "last_event_at",
          "events",
        ],
        properties: {
          id: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          country: { type: ["string", "null"] },
          type: { type: "string", enum: [...WHATSAPP_MESSAGE_TYPES] },
          text: { type: ["string", "null"] },
          preview_url: { type: "boolean" },
          template: { oneOf: [{ $ref: "#/components/schemas/WhatsappTemplate" }, { type: "null" }] },
          media: { oneOf: [{ $ref: "#/components/schemas/WhatsappMedia" }, { type: "null" }] },
          provider: {
            type: ["string", "null"],
            description: "Provider the message was routed to, set at send time (e.g. meta).",
          },
          provider_message_id: {
            type: ["string", "null"],
            description: "Provider-side message id (wamid on Meta); replies reference it.",
          },
          status: { type: "string", enum: [...WHATSAPP_STATUSES] },
          error: {
            type: ["string", "null"],
            description: "Failure detail when status is failed.",
          },
          created_at: { type: "string", format: "date-time" },
          last_event_at: { type: ["string", "null"], format: "date-time" },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/WhatsappEvent" },
          },
        },
      },
      WhatsappEvent: {
        type: "object",
        required: ["type", "created_at"],
        properties: {
          type: { type: "string", enum: [...WHATSAPP_EVENT_TYPES] },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
} as const;
