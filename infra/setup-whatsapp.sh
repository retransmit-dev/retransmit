#!/usr/bin/env bash
#
# One-time setup of Retransmit's Meta WhatsApp webhook. Retransmit owns the
# Meta app, the WhatsApp Business Account (WABA) and the phone number;
# customers only talk to the Retransmit API.
#
#   ./infra/setup-whatsapp.sh                  # register prod callback + subscribe the WABA
#   ./infra/setup-whatsapp.sh https://staging.example/v1/callbacks/whatsapp/meta
#                                              # ...a different callback URL
#
# Required env (same names apps/api reads, see packages/whatsapp/src/providers/meta.ts):
#   WHATSAPP_META_APP_ID          Meta app id
#   WHATSAPP_META_APP_SECRET      Meta app secret (also signs the webhook posts)
#   WHATSAPP_META_VERIFY_TOKEN    any random string; the API echoes Meta's challenge
#                                 only when this matches
#   WHATSAPP_META_WABA_ID         WhatsApp Business Account id
#   WHATSAPP_META_ACCESS_TOKEN    permanent System User token with
#                                 whatsapp_business_management + whatsapp_business_messaging
# Optional: WHATSAPP_META_API_VERSION (default v23.0), META_GRAPH_API_BASE_URL.
#
# Registering the callback makes Meta GET it immediately with the verify
# token, so apps/api must already be deployed at that URL. Without a
# subscribed webhook every message stays at "sent" forever and replies are
# lost. Safe to re-run: both calls are idempotent.
set -euo pipefail

: "${WHATSAPP_META_APP_ID:?set WHATSAPP_META_APP_ID}"
: "${WHATSAPP_META_APP_SECRET:?set WHATSAPP_META_APP_SECRET}"
: "${WHATSAPP_META_VERIFY_TOKEN:?set WHATSAPP_META_VERIFY_TOKEN}"
: "${WHATSAPP_META_WABA_ID:?set WHATSAPP_META_WABA_ID}"
: "${WHATSAPP_META_ACCESS_TOKEN:?set WHATSAPP_META_ACCESS_TOKEN}"

VERSION="${WHATSAPP_META_API_VERSION:-v23.0}"
GRAPH="${META_GRAPH_API_BASE_URL:-https://graph.facebook.com}/${VERSION}"
CALLBACK_URL="${1:-${WHATSAPP_CALLBACK_URL:-https://api.retransmit.dev/v1/callbacks/whatsapp/meta}}"

echo "App: $WHATSAPP_META_APP_ID  WABA: $WHATSAPP_META_WABA_ID"
echo "Callback: $CALLBACK_URL"

# 0. Preflight: the handshake the way Meta will do it.
CHALLENGE="retransmit-$(date +%s)"
ECHOED=$(curl -fsS "${CALLBACK_URL}?hub.mode=subscribe&hub.verify_token=${WHATSAPP_META_VERIFY_TOKEN}&hub.challenge=${CHALLENGE}" || true)
if [ "$ECHOED" != "$CHALLENGE" ]; then
  echo "Callback did not echo the challenge (got: '${ECHOED}')." >&2
  echo "Deploy apps/api with WHATSAPP_META_VERIFY_TOKEN set, then re-run." >&2
  exit 1
fi
echo "Preflight ok (challenge echoed)"

# 1. Point the app's whatsapp_business_account webhook at us. Uses the app
#    access token (app_id|app_secret). Meta verifies the URL synchronously.
curl -fsS -X POST "${GRAPH}/${WHATSAPP_META_APP_ID}/subscriptions" \
  --data-urlencode "object=whatsapp_business_account" \
  --data-urlencode "callback_url=${CALLBACK_URL}" \
  --data-urlencode "verify_token=${WHATSAPP_META_VERIFY_TOKEN}" \
  --data-urlencode "fields=messages" \
  --data-urlencode "access_token=${WHATSAPP_META_APP_ID}|${WHATSAPP_META_APP_SECRET}"
echo
echo "App webhook registered (field: messages)"

# 2. Subscribe the app to this WABA so its numbers actually emit events.
curl -fsS -X POST "${GRAPH}/${WHATSAPP_META_WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer ${WHATSAPP_META_ACCESS_TOKEN}"
echo
echo "WABA subscribed"

# 3. Show what Meta has on file.
echo "Subscribed apps on the WABA:"
curl -fsS "${GRAPH}/${WHATSAPP_META_WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer ${WHATSAPP_META_ACCESS_TOKEN}"
echo
echo "Done. Send a test message and watch for whatsapp.delivered."
