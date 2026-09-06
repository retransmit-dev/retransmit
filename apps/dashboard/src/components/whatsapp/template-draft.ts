/**
 * Client-side view of a WhatsApp template: the pieces the editor collects
 * and the preview renders. Mirrors `templateDraftSchema` in
 * @retransmit/whatsapp/templates without pulling that package (and the
 * database) into the browser bundle.
 */

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

export function placeholdersAreSequential(indexes: number[]): boolean {
  const sorted = [...indexes].sort((a, b) => a - b);
  return sorted.every((value, i) => value === i + 1);
}

export type TemplateButtonType = "quick_reply" | "url" | "phone_number";

export interface TemplateButtonDraft {
  type: TemplateButtonType;
  text: string;
  /** URL for `url` buttons, phone number for `phone_number` buttons. */
  value: string;
}

export const TEMPLATE_CATEGORIES = [
  { value: "utility", label: "Utility" },
  { value: "marketing", label: "Marketing" },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["value"];

/** Meta language codes. The most used ones first, then alphabetical. */
export const TEMPLATE_LANGUAGES = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "es_MX", label: "Spanish (Mexico)" },
  { value: "pt_BR", label: "Portuguese (Brazil)" },
  { value: "pt_PT", label: "Portuguese (Portugal)" },
  { value: "ar", label: "Arabic" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "id", label: "Indonesian" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "sw", label: "Swahili" },
  { value: "tr", label: "Turkish" },
  { value: "zh_CN", label: "Chinese (Simplified)" },
] as const;

export type TemplateHeaderMediaFormat = "image" | "video" | "document" | "location";

/** What the preview shows: text pieces with placeholders already filled. */
export interface TemplatePreviewContent {
  /** Text header. Ignored when `headerMedia` is set. */
  header?: string;
  /** Media header. `url` is Meta's sample handle when the template was synced. */
  headerMedia?: { format: TemplateHeaderMediaFormat; url?: string };
  body: string;
  footer?: string;
  buttons: { type: TemplateButtonType; text: string }[];
}

/** Replaces `{{n}}` with `examples[n - 1]`, leaving the token when no example is set. */
export function fillPlaceholders(text: string, examples: string[]): string {
  return text.replace(PLACEHOLDER_PATTERN, (token, index: string) => {
    const example = examples[Number(index) - 1]?.trim();
    return example ? example : token;
  });
}

/**
 * Turns a Meta `components` array (as stored on a template row) into
 * preview content, using the examples Meta keeps on each component.
 */
export function previewFromComponents(components: Record<string, unknown>[]): TemplatePreviewContent {
  const content: TemplatePreviewContent = { body: "", buttons: [] };
  for (const component of components) {
    const type = String(component.type ?? "").toUpperCase();
    const text = typeof component.text === "string" ? component.text : "";
    const example = component.example as
      | { header_text?: string[]; body_text?: string[][]; header_handle?: string[] }
      | undefined;
    switch (type) {
      case "HEADER": {
        const format = String(component.format ?? "TEXT").toLowerCase();
        if (format === "text") {
          content.header = fillPlaceholders(text, example?.header_text ?? []);
        } else if (
          format === "image" ||
          format === "video" ||
          format === "document" ||
          format === "location"
        ) {
          const url = example?.header_handle?.[0];
          content.headerMedia = { format, url: typeof url === "string" ? url : undefined };
        }
        break;
      }
      case "BODY":
        content.body = fillPlaceholders(text, example?.body_text?.[0] ?? []);
        break;
      case "FOOTER":
        content.footer = text;
        break;
      case "BUTTONS": {
        const buttons = Array.isArray(component.buttons) ? component.buttons : [];
        for (const button of buttons as Record<string, unknown>[]) {
          const buttonType = String(button.type ?? "").toLowerCase();
          content.buttons.push({
            type:
              buttonType === "url" || buttonType === "phone_number" ? buttonType : "quick_reply",
            text: typeof button.text === "string" ? button.text : "",
          });
        }
        break;
      }
    }
  }
  return content;
}
