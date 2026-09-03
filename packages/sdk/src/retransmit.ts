import { Batch } from "./batch";
import { Emails } from "./emails";
import { Sms } from "./sms";
import { Whatsapp } from "./whatsapp";
import type { Result, RetransmitError, RetransmitOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.retransmit.dev";
const USER_AGENT = "retransmit.dev-node/0.1.0";

function readEnv(name: string): string | undefined {
  // Guarded so the SDK also loads in edge/browser-like runtimes without `process`.
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

export class Retransmit {
  readonly emails = new Emails(this);
  readonly sms = new Sms(this);
  readonly whatsapp = new Whatsapp(this);
  readonly batch = new Batch(this);

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, options: RetransmitOptions = {}) {
    const key = apiKey ?? readEnv("RETRANSMIT_API_KEY");
    if (!key) {
      throw new Error(
        'Missing API key. Pass it to `new Retransmit("rt_...")` or set the RETRANSMIT_API_KEY environment variable.',
      );
    }
    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? readEnv("RETRANSMIT_BASE_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
  }

  /** Internal transport shared by the resource classes. API failures are returned, never thrown. */
  async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<Result<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      return {
        data: null,
        error: {
          code: "network_error",
          message: cause instanceof Error ? cause.message : "Unable to reach the Retransmit API",
        },
      };
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Non-JSON body; fall through to the status-based error below.
    }

    if (!response.ok) {
      const error = (json as { error?: RetransmitError } | null)?.error;
      return {
        data: null,
        error: error ?? {
          code: "internal_error",
          message: `Request failed with status ${response.status}`,
        },
      };
    }

    return { data: json as T, error: null };
  }
}
