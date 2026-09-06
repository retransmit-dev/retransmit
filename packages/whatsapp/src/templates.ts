import { db } from "@retransmit/db";
import { createId } from "@retransmit/db/id";
import { whatsappTemplate } from "@retransmit/db/schema/whatsapp";
import type { WhatsappTemplateCategory } from "@retransmit/db/schema/whatsapp";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { decryptSecret } from "./crypto";
import { graph } from "./meta-signup";
import type { WhatsappAccountRow } from "./accounts";

/**
 * Message templates on Meta's WhatsApp Business Platform
 * (https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates).
 *
 * A template is created once per WABA, reviewed by Meta (minutes to a day),
 * and then sent by `name` + `language` through `POST /v1/whatsapp`. Body and
 * header text use positional `{{1}}`, `{{2}}`… placeholders; Meta requires an
 * example value for every placeholder so reviewers can read the message.
 *
 * Only text templates are handled here: a text header, body, footer and up
 * to three buttons. Media headers, carousels and authentication templates
 * (which have a fixed layout) still go through WhatsApp Manager.
 */

export type WhatsappTemplateRow = typeof whatsappTemplate.$inferSelect;

export const PLACEHOLDER_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

/** Placeholder numbers in order of first appearance, e.g. `[1, 2]`. */
export function placeholdersIn(text: string): number[] {
  const seen: number[] = [];
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const index = Number(match[1]);
    if (!seen.includes(index)) seen.push(index);
  }
  return seen;
}

/** Meta rejects gaps: placeholders must be `{{1}}`…`{{n}}` with none missing. */
export function placeholdersAreSequential(indexes: number[]): boolean {
  const sorted = [...indexes].sort((a, b) => a - b);
  return sorted.every((value, i) => value === i + 1);
}

const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("quick_reply"), text: z.string().trim().min(1).max(25) }),
  z.object({
    type: z.literal("url"),
    text: z.string().trim().min(1).max(25),
    url: z.string().trim().url().max(2000),
  }),
  z.object({
    type: z.literal("phone_number"),
    text: z.string().trim().min(1).max(25),
    phoneNumber: z.string().trim().min(5).max(20),
  }),
]);

export type TemplateButton = z.infer<typeof buttonSchema>;

/**
 * What the dashboard form produces. `examples` are indexed by placeholder
 * number minus one: `examples[0]` stands in for `{{1}}`.
 */
export const templateDraftSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores only"),
    language: z.string().trim().min(2).max(16),
    category: z.enum(["utility", "marketing"]),
    header: z
      .object({ text: z.string().trim().min(1).max(60), example: z.string().trim().max(60).optional() })
      .optional(),
    body: z.object({
      text: z.string().trim().min(1).max(1024),
      examples: z.array(z.string().trim().max(1024)).max(100),
    }),
    footer: z.object({ text: z.string().trim().min(1).max(60) }).optional(),
    buttons: z.array(buttonSchema).max(3).optional(),
  })
  .superRefine((draft, ctx) => {
    const bodyPlaceholders = placeholdersIn(draft.body.text);
    if (!placeholdersAreSequential(bodyPlaceholders)) {
      ctx.addIssue({
        code: "custom",
        path: ["body", "text"],
        message: "Placeholders must run {{1}}, {{2}}, {{3}}… without gaps",
      });
    }
    bodyPlaceholders.forEach((index) => {
      if (!draft.body.examples[index - 1]?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["body", "examples", index - 1],
          message: `Give an example value for {{${index}}}`,
        });
      }
    });
    if (draft.header) {
      const headerPlaceholders = placeholdersIn(draft.header.text);
      if (headerPlaceholders.length > 1 || (headerPlaceholders.length === 1 && headerPlaceholders[0] !== 1)) {
        ctx.addIssue({
          code: "custom",
          path: ["header", "text"],
          message: "A header can hold one placeholder, and it must be {{1}}",
        });
      }
      if (headerPlaceholders.length === 1 && !draft.header.example?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["header", "example"],
          message: "Give an example value for the header placeholder",
        });
      }
    }
    if (draft.footer && placeholdersIn(draft.footer.text).length > 0) {
      ctx.addIssue({ code: "custom", path: ["footer", "text"], message: "Footers cannot hold placeholders" });
    }
  });

export type TemplateDraft = z.infer<typeof templateDraftSchema>;

/** Meta `components` for a draft, in the order Meta expects. */
export function buildTemplateComponents(draft: TemplateDraft): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];

  if (draft.header) {
    const hasPlaceholder = placeholdersIn(draft.header.text).length > 0;
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: draft.header.text,
      ...(hasPlaceholder ? { example: { header_text: [draft.header.example ?? ""] } } : {}),
    });
  }

  const bodyPlaceholders = placeholdersIn(draft.body.text);
  components.push({
    type: "BODY",
    text: draft.body.text,
    ...(bodyPlaceholders.length > 0
      ? {
          example: {
            body_text: [
              [...bodyPlaceholders].sort((a, b) => a - b).map((index) => draft.body.examples[index - 1] ?? ""),
            ],
          },
        }
      : {}),
  });

  if (draft.footer) components.push({ type: "FOOTER", text: draft.footer.text });

  if (draft.buttons && draft.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: draft.buttons.map((button) => {
        switch (button.type) {
          case "quick_reply":
            return { type: "QUICK_REPLY", text: button.text };
          case "url":
            return { type: "URL", text: button.text, url: button.url };
          case "phone_number":
            return { type: "PHONE_NUMBER", text: button.text, phone_number: button.phoneNumber };
        }
      }),
    });
  }

  return components;
}

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejected_reason?: string | null;
  components?: Record<string, unknown>[];
}

/** Meta reports statuses and categories in upper case; rows keep them lower case. */
function lower(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function categoryOf(value: string): WhatsappTemplateCategory {
  const category = lower(value);
  return category === "marketing" || category === "authentication" ? category : "utility";
}

/** Meta reports `NONE` when nothing is wrong; that is not a reason. */
function reasonOf(value: string | null | undefined): string | null {
  return value && value.toUpperCase() !== "NONE" ? value : null;
}

/**
 * Submits a draft to Meta for review and stores the resulting row. The
 * template starts out `pending`; the webhook (or `syncTemplates`) moves it.
 */
export async function createTemplate(
  account: WhatsappAccountRow,
  draft: TemplateDraft,
): Promise<WhatsappTemplateRow> {
  const components = buildTemplateComponents(draft);
  const created = await graph<{ id?: string; status?: string; category?: string }>(
    `${encodeURIComponent(account.wabaId)}/message_templates`,
    {
      method: "POST",
      token: decryptSecret(account.accessToken),
      body: JSON.stringify({
        name: draft.name,
        language: draft.language,
        category: draft.category.toUpperCase(),
        components,
      }),
    },
  );

  const values = {
    organizationId: account.organizationId,
    accountId: account.id,
    provider: account.provider,
    wabaId: account.wabaId,
    providerTemplateId: created.id ?? null,
    name: draft.name,
    language: draft.language,
    category: created.category ? categoryOf(created.category) : draft.category,
    status: created.status ? lower(created.status) : "pending",
    rejectedReason: null,
    components,
    lastSyncedAt: new Date(),
  };
  const [row] = await db
    .insert(whatsappTemplate)
    .values({ id: createId("wat"), ...values })
    .onConflictDoUpdate({
      target: [whatsappTemplate.provider, whatsappTemplate.wabaId, whatsappTemplate.name, whatsappTemplate.language],
      set: values,
    })
    .returning();
  if (!row) throw new Error("Could not store the template");
  return row;
}

/**
 * Pulls every template on the account's WABA and upserts it, so templates
 * made in WhatsApp Manager show up too and statuses catch up when a webhook
 * was missed. Templates Meta no longer lists are removed.
 */
export async function syncTemplates(account: WhatsappAccountRow): Promise<WhatsappTemplateRow[]> {
  const token = decryptSecret(account.accessToken);
  const remote: MetaTemplate[] = [];
  let after: string | undefined;
  do {
    const page = await graph<{ data?: MetaTemplate[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `${encodeURIComponent(account.wabaId)}/message_templates`,
      {
        token,
        query: {
          fields: "id,name,language,category,status,rejected_reason,components",
          limit: "100",
          ...(after ? { after } : {}),
        },
      },
    );
    remote.push(...(page.data ?? []));
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
  } while (after);

  const existing = await db
    .select()
    .from(whatsappTemplate)
    .where(and(eq(whatsappTemplate.provider, account.provider), eq(whatsappTemplate.wabaId, account.wabaId)));

  const rows: WhatsappTemplateRow[] = [];
  const seen = new Set<string>();
  for (const template of remote) {
    seen.add(`${template.name} ${template.language}`);
    const values = {
      organizationId: account.organizationId,
      accountId: account.id,
      provider: account.provider,
      wabaId: account.wabaId,
      providerTemplateId: template.id,
      name: template.name,
      language: template.language,
      category: categoryOf(template.category),
      status: lower(template.status) || "pending",
      rejectedReason: reasonOf(template.rejected_reason),
      components: template.components ?? [],
      lastSyncedAt: new Date(),
    };
    const [row] = await db
      .insert(whatsappTemplate)
      .values({ id: createId("wat"), ...values })
      .onConflictDoUpdate({
        target: [whatsappTemplate.provider, whatsappTemplate.wabaId, whatsappTemplate.name, whatsappTemplate.language],
        set: values,
      })
      .returning();
    if (row) rows.push(row);
  }

  for (const row of existing) {
    if (!seen.has(`${row.name} ${row.language}`)) {
      await db.delete(whatsappTemplate).where(eq(whatsappTemplate.id, row.id));
    }
  }
  return rows;
}

/**
 * Deletes the template on Meta, then locally. Meta keeps deleted names
 * reserved for 30 days, so a template cannot be recreated under the same
 * name right away.
 */
export async function deleteTemplate(account: WhatsappAccountRow, row: WhatsappTemplateRow): Promise<void> {
  await graph(`${encodeURIComponent(account.wabaId)}/message_templates`, {
    method: "DELETE",
    token: decryptSecret(account.accessToken),
    query: {
      name: row.name,
      ...(row.providerTemplateId ? { hsm_id: row.providerTemplateId } : {}),
    },
  });
  await db.delete(whatsappTemplate).where(eq(whatsappTemplate.id, row.id));
}

/**
 * Applies a `message_template_status_update` webhook. Returns false when
 * the template is unknown here (created elsewhere and never synced).
 */
export async function applyTemplateStatusUpdate(input: {
  provider: string;
  wabaId: string;
  templateId?: string;
  name: string;
  language: string;
  event: string;
  reason?: string | null;
}): Promise<boolean> {
  const status = lower(input.event);
  if (!status) return false;
  const updated = await db
    .update(whatsappTemplate)
    .set({
      status,
      rejectedReason: reasonOf(input.reason),
      ...(input.templateId ? { providerTemplateId: input.templateId } : {}),
      lastSyncedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappTemplate.provider, input.provider),
        eq(whatsappTemplate.wabaId, input.wabaId),
        eq(whatsappTemplate.name, input.name),
        eq(whatsappTemplate.language, input.language),
      ),
    )
    .returning({ id: whatsappTemplate.id });
  return updated.length > 0;
}
