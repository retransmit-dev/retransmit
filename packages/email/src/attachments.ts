import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { DEFAULT_SES_REGION } from "./regions";

/*
 * Attachment storage. Sending is asynchronous (API request now, worker send
 * later), so attachment bytes are parked in S3 between the two. One private
 * bucket per SES region, `${ATTACHMENTS_BUCKET_PREFIX}-${region}`, created by
 * infra/setup-attachments.sh with a lifecycle rule that deletes objects
 * ATTACHMENT_RETENTION_DAYS after upload. The same object serves the send and
 * the dashboard download link; the email_attachment row outlives it.
 */

/** Attachments per email. */
export const ATTACHMENTS_MAX = 20;
/**
 * Raw bytes across all attachments of one email. Base64 in the MIME message
 * grows it by a third, which lands under the 40 MB SES v2 message limit.
 */
export const ATTACHMENTS_TOTAL_MAX_BYTES = 30 * 1024 * 1024;
/** Matches the lifecycle rule on the buckets. */
export const ATTACHMENT_RETENTION_DAYS = 30;
/** How long a presigned download link stays valid. */
export const ATTACHMENT_URL_TTL_SECONDS = 60 * 60;
/** Budget for fetching one remote `path` attachment. */
export const REMOTE_FETCH_TIMEOUT_MS = 15_000;
const REMOTE_FETCH_MAX_REDIRECTS = 3;

/**
 * Extensions SES refuses outright (its "unsupported attachment types" list).
 * Rejected at the API so the caller finds out now, not from a failed send.
 */
export const BLOCKED_EXTENSIONS = new Set([
  "ade", "adp", "app", "asp", "bas", "bat", "cer", "chm", "cmd", "com", "cpl", "crt", "csh",
  "der", "exe", "fxp", "gadget", "hlp", "hta", "inf", "ins", "isp", "its", "js", "jse", "ksh",
  "lib", "lnk", "mad", "maf", "mag", "mam", "maq", "mar", "mas", "mat", "mau", "mav", "maw",
  "mda", "mdb", "mde", "mdt", "mdw", "mdz", "msc", "msh", "msh1", "msh2", "mshxml", "msh1xml",
  "msh2xml", "msi", "msp", "mst", "ops", "pcd", "pif", "plg", "prf", "prg", "reg", "scf", "scr",
  "sct", "shb", "shs", "sys", "ps1", "ps1xml", "ps2", "ps2xml", "psc1", "psc2", "tmp", "url",
  "vb", "vbe", "vbs", "vps", "vsmacros", "vss", "vst", "vsw", "vxd", "ws", "wsc", "wsf", "wsh",
  "xnk",
]);

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  xml: "application/xml",
  json: "application/json",
  ics: "text/calendar",
  zip: "application/zip",
  gz: "application/gzip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  rtf: "application/rtf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
  eml: "message/rfc822",
};

/** A problem with the caller's attachment: bad file, unreachable URL, too big. */
export class AttachmentError extends Error {
  readonly code = "invalid_attachment";
}

/** The S3 object is gone (expired) or was never written. */
export class AttachmentMissingError extends Error {}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function inferContentType(filename: string): string {
  return CONTENT_TYPES_BY_EXTENSION[extensionOf(filename)] ?? "application/octet-stream";
}

export function attachmentBucket(region: string): string {
  const prefix = process.env.ATTACHMENTS_BUCKET_PREFIX;
  if (!prefix) throw new Error("ATTACHMENTS_BUCKET_PREFIX is not set");
  return `${prefix}-${region}`;
}

export function attachmentKey(organizationId: string, emailId: string, attachmentId: string) {
  return `${organizationId}/${emailId}/${attachmentId}`;
}

const clients = new Map<string, S3Client>();
function getS3Client(region: string): S3Client {
  let client = clients.get(region);
  if (!client) {
    client = new S3Client({ region });
    clients.set(region, client);
  }
  return client;
}

export interface StoredObject {
  region: string;
  key: string;
}

export async function putAttachment(
  target: StoredObject,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await getS3Client(target.region).send(
    new PutObjectCommand({
      Bucket: attachmentBucket(target.region),
      Key: target.key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    }),
  );
}

export async function getAttachment(source: StoredObject): Promise<Uint8Array> {
  let response;
  try {
    response = await getS3Client(source.region).send(
      new GetObjectCommand({ Bucket: attachmentBucket(source.region), Key: source.key }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      throw new AttachmentMissingError(`Attachment ${source.key} has expired`);
    }
    throw error;
  }
  if (!response.Body) throw new AttachmentMissingError(`Attachment ${source.key} is empty`);
  return response.Body.transformToByteArray();
}

/** Presigned GET that downloads as `filename`, valid for ATTACHMENT_URL_TTL_SECONDS. */
export function attachmentDownloadUrl(
  source: StoredObject,
  file: { filename: string; contentType: string },
): Promise<string> {
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`;
  return getSignedUrl(
    getS3Client(source.region),
    new GetObjectCommand({
      Bucket: attachmentBucket(source.region),
      Key: source.key,
      ResponseContentDisposition: disposition,
      ResponseContentType: file.contentType,
    }),
    { expiresIn: ATTACHMENT_URL_TTL_SECONDS },
  );
}

/**
 * Whether an IP address is loopback, private, link-local or otherwise not
 * routable on the public internet. Remote attachment URLs may not point at
 * these, so a caller cannot use us to read from our own network.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateV4(address);
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateV4(mapped[1]);
    if (lower === "::" || lower === "::1") return true;
    // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast
    return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith("ff");
  }
  return true;
}

function isPrivateV4(address: string): boolean {
  const [a = 0, b = 0] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AttachmentError(`\`${url.href}\` must be an http or https URL`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new AttachmentError(`\`${url.href}\` points at a private host`);
  }
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true })
        .then((entries) => entries.map((entry) => entry.address))
        .catch(() => {
          throw new AttachmentError(`Could not resolve \`${url.hostname}\``);
        });
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new AttachmentError(`\`${url.href}\` points at a private host`);
  }
}

/**
 * Downloads a remote attachment with the guards a public API needs: public
 * hosts only (checked again on every redirect), a time budget, and a byte cap
 * enforced while streaming so an oversized file is dropped early.
 */
export async function fetchRemoteAttachment(
  path: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  let url: URL;
  try {
    url = new URL(path);
  } catch {
    throw new AttachmentError(`\`${path}\` is not a valid URL`);
  }
  const deadline = AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS);

  for (let hop = 0; ; hop++) {
    await assertPublicHost(url);
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: deadline });
    } catch (cause) {
      const reason = deadline.aborted ? "timed out" : "could not be fetched";
      throw new AttachmentError(`\`${url.href}\` ${reason}`, { cause });
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop >= REMOTE_FETCH_MAX_REDIRECTS) {
        throw new AttachmentError(`\`${url.href}\` redirected too many times`);
      }
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new AttachmentError(`\`${url.href}\` answered HTTP ${response.status}`);
    }

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel();
      throw new AttachmentError(`\`${url.href}\` is larger than ${formatBytes(maxBytes)}`);
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const next = await reader.read().catch((cause: unknown) => {
          throw new AttachmentError(`\`${url.href}\` timed out`, { cause });
        });
        if (next.done) break;
        received += next.value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new AttachmentError(`\`${url.href}\` is larger than ${formatBytes(maxBytes)}`);
        }
        chunks.push(next.value);
      }
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || null;
    return { bytes, contentType };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** One attachment as accepted by the API, after schema validation. */
export interface AttachmentInput {
  filename: string;
  /** Base64 content. Exactly one of `content` and `path` is set. */
  content?: string;
  /** Remote URL fetched now, at request time. */
  path?: string;
  contentType?: string;
  contentId?: string;
}

/** What to persist for one stored attachment. */
export interface StoredAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  inline: boolean;
  storageRegion: string;
  storageKey: string;
  sourceUrl: string | null;
  expiresAt: Date;
}

function decodeBase64(content: string, filename: string): Uint8Array {
  const cleaned = content.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new AttachmentError(`\`${filename}\`: content is not valid base64`);
  }
  const bytes = Buffer.from(cleaned, "base64");
  if (bytes.byteLength === 0) throw new AttachmentError(`\`${filename}\`: content is empty`);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Resolves every attachment's bytes (decoding `content` or fetching `path`),
 * checks file type and total size, and uploads each to the bucket of
 * `region`. Runs in the API request so the caller gets a 422 for a bad file
 * instead of a failed send later. Objects orphaned by a failure after this
 * point expire with the lifecycle rule.
 */
export async function storeAttachments(
  inputs: AttachmentInput[],
  target: { organizationId: string; emailId: string; region?: string; createId: () => string },
): Promise<StoredAttachment[]> {
  if (inputs.length === 0) return [];
  if (inputs.length > ATTACHMENTS_MAX) {
    throw new AttachmentError(`At most ${ATTACHMENTS_MAX} attachments per email`);
  }
  const region = target.region ?? DEFAULT_SES_REGION;

  const resolved: { input: AttachmentInput; bytes: Uint8Array; contentType: string }[] = [];
  let total = 0;
  for (const input of inputs) {
    const extension = extensionOf(input.filename);
    if (BLOCKED_EXTENSIONS.has(extension)) {
      throw new AttachmentError(
        `\`${input.filename}\`: .${extension} files cannot be sent by email`,
      );
    }
    let bytes: Uint8Array;
    let detectedType: string | null = null;
    if (input.content !== undefined) {
      bytes = decodeBase64(input.content, input.filename);
    } else if (input.path !== undefined) {
      const remote = await fetchRemoteAttachment(input.path, ATTACHMENTS_TOTAL_MAX_BYTES - total);
      bytes = remote.bytes;
      detectedType = remote.contentType;
    } else {
      throw new AttachmentError(`\`${input.filename}\`: provide \`content\` or \`path\``);
    }
    total += bytes.byteLength;
    if (total > ATTACHMENTS_TOTAL_MAX_BYTES) {
      throw new AttachmentError(
        `Attachments exceed ${formatBytes(ATTACHMENTS_TOTAL_MAX_BYTES)} in total`,
      );
    }
    const contentType =
      input.contentType ??
      (detectedType && detectedType !== "application/octet-stream"
        ? detectedType
        : inferContentType(input.filename));
    resolved.push({ input, bytes, contentType });
  }

  const expiresAt = new Date(Date.now() + ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return Promise.all(
    resolved.map(async ({ input, bytes, contentType }) => {
      const id = target.createId();
      const key = attachmentKey(target.organizationId, target.emailId, id);
      await putAttachment({ region, key }, bytes, contentType);
      return {
        id,
        filename: input.filename,
        contentType,
        size: bytes.byteLength,
        contentId: input.contentId ?? null,
        inline: input.contentId !== undefined,
        storageRegion: region,
        storageKey: key,
        sourceUrl: input.path ?? null,
        expiresAt,
      };
    }),
  );
}
