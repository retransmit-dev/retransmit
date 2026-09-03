import { describe, expect, it } from "vitest";

import { OPENAPI_DOCUMENT } from "./openapi";

type Operation = {
  operationId?: string;
  responses?: Record<string, unknown>;
  security?: unknown[];
};

function operations(): [string, string, Operation][] {
  const found: [string, string, Operation][] = [];
  for (const [path, methods] of Object.entries(OPENAPI_DOCUMENT.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      found.push([path, method, operation as Operation]);
    }
  }
  return found;
}

describe("OPENAPI_DOCUMENT", () => {
  it("declares OpenAPI 3.1 with info and servers", () => {
    expect(OPENAPI_DOCUMENT.openapi).toBe("3.1.0");
    expect(OPENAPI_DOCUMENT.info.title).toBe("Retransmit API");
    expect(OPENAPI_DOCUMENT.info.version).toBeTruthy();
    expect(OPENAPI_DOCUMENT.servers[0].url).toBe("https://api.retransmit.dev");
  });

  it("documents the full API surface", () => {
    const paths = Object.keys(OPENAPI_DOCUMENT.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/health",
        "/v1/emails",
        "/v1/emails/{id}",
        "/v1/emails/tags",
        "/v1/emails/batch",
        "/v1/emails/batch/{id}",
      ]),
    );
  });

  it("gives every operation an operationId and responses", () => {
    const ids = new Set<string>();
    for (const [path, method, operation] of operations()) {
      expect(operation.operationId, `${method} ${path}`).toBeTruthy();
      expect(ids.has(operation.operationId!), `duplicate ${operation.operationId}`).toBe(false);
      ids.add(operation.operationId!);
      expect(
        Object.keys(operation.responses ?? {}).length,
        `${method} ${path}`,
      ).toBeGreaterThan(0);
    }
  });

  it("references only schemas that exist", () => {
    const declared = new Set(
      Object.keys(OPENAPI_DOCUMENT.components.schemas).map(
        (name) => `#/components/schemas/${name}`,
      ),
    );
    const refs = JSON.stringify(OPENAPI_DOCUMENT).match(
      /"#\/components\/schemas\/[^"]+"/g,
    )!;
    for (const ref of refs) {
      expect(declared.has(JSON.parse(ref)), ref).toBe(true);
    }
  });

  it("secures /v1 endpoints with bearer auth and leaves /health open", () => {
    expect(OPENAPI_DOCUMENT.security).toEqual([{ bearerAuth: [] }]);
    expect(OPENAPI_DOCUMENT.components.securitySchemes.bearerAuth.scheme).toBe(
      "bearer",
    );
    expect(OPENAPI_DOCUMENT.paths["/health"].get.security).toEqual([]);
  });

  it("documents the JSON error contract with stable codes", () => {
    const error = OPENAPI_DOCUMENT.components.schemas.Error;
    expect(error.properties.error.properties.code.enum).toEqual(
      expect.arrayContaining([
        "invalid_json",
        "validation_error",
        "unauthorized",
        "domain_not_found",
        "domain_not_verified",
        "not_found",
        "internal_error",
      ]),
    );
  });

  it("is JSON-serializable", () => {
    expect(() => JSON.stringify(OPENAPI_DOCUMENT)).not.toThrow();
  });
});
