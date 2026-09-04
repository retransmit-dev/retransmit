# Retransmit monorepo

## Client SDKs live in separate repos

The public API (`apps/api`, OpenAPI document in `apps/web/src/lib/openapi.ts`) has
hand-written SDKs in their own repositories. They are not generated and nothing here
checks them.

| Language | Repository | Local checkout |
| --- | --- | --- |
| Node.js | https://github.com/retransmit-dev/retransmit-node | `~/Developer/retransmit-node` |

When an API change is visible to clients (new or changed endpoint, request or response
field, status value, error code, or channel), update each SDK too: types, channel file,
README, and a version bump. Pushing the bump to `main` in the SDK repo publishes it.
Also update the docs in `apps/docs` and the OpenAPI document.
