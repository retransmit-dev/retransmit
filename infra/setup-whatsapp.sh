#!/usr/bin/env bash
#
# One-time setup of Retransmit's Meta app webhook for WhatsApp. Retransmit
# owns the Meta app; each customer connects their own WhatsApp Business
# Account and number through Embedded Signup in the dashboard, which
# subscribes this app to their account at connect time. This script only
# points the app's `whatsapp_business_account` webhook at our API and picks
# the fields we handle: `messages` (statuses, replies),
# `message_template_status_update` (template reviews), `account_update`
# (business unlinked a number) and the three the WhatsApp Business app
# path needs (`history`, `smb_app_state_sync`, `smb_message_echoes`).
# Without those three Meta will not complete a Business app onboarding.
#
#   ./infra/setup-whatsapp.sh                  # register the prod callback
#   ./infra/setup-whatsapp.sh https://staging.example/v1/callbacks/whatsapp/meta
#
# Required env (same names apps/api reads):
#   WHATSAPP_META_APP_ID          Meta app id
#   WHATSAPP_META_APP_SECRET      Meta app secret (also signs the webhook posts)
#   WHATSAPP_META_VERIFY_TOKEN    any random string; the API echoes Meta's challenge
#                                 only when this matches
# Optional: META_GRAPH_API_BASE_URL (local mock). The Graph API version is
# fixed here and in packages/whatsapp/src/providers/meta.ts; bump both.
#
# Registering the callback makes Meta GET it immediately with the verify
# token, so apps/api must already be deployed at that URL. Without this
# webhook every message stays at "sent" forever and replies are lost.
# Safe to re-run.
#
# Still manual in the App Dashboard: add the "WhatsApp" and "Facebook Login
# for Business" products, create an Embedded Signup configuration (v4, in
# the Embedded Signup Builder; v2 configurations stop working on
# 2026-10-15) and put its id in WHATSAPP_META_SIGNUP_CONFIG_ID, and request
# Advanced Access for whatsapp_business_management and
# whatsapp_business_messaging.
set -euo pipefail

: "${WHATSAPP_META_APP_ID:?set WHATSAPP_META_APP_ID}"
: "${WHATSAPP_META_APP_SECRET:?set WHATSAPP_META_APP_SECRET}"
: "${WHATSAPP_META_VERIFY_TOKEN:?set WHATSAPP_META_VERIFY_TOKEN}"

VERSION="v26.0"
GRAPH="${META_GRAPH_API_BASE_URL:-https://graph.facebook.com}/${VERSION}"
CALLBACK_URL="${1:-${WHATSAPP_CALLBACK_URL:-https://api.retransmit.dev/v1/callbacks/whatsapp/meta}}"

echo "App: $WHATSAPP_META_APP_ID"
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
FIELDS="messages,message_template_status_update,account_update,history,smb_app_state_sync,smb_message_echoes"
curl -fsS -X POST "${GRAPH}/${WHATSAPP_META_APP_ID}/subscriptions" \
  --data-urlencode "object=whatsapp_business_account" \
  --data-urlencode "callback_url=${CALLBACK_URL}" \
  --data-urlencode "verify_token=${WHATSAPP_META_VERIFY_TOKEN}" \
  --data-urlencode "fields=${FIELDS}" \
  --data-urlencode "access_token=${WHATSAPP_META_APP_ID}|${WHATSAPP_META_APP_SECRET}"
echo
echo "App webhook registered (fields: ${FIELDS})"

# 2. Show what Meta has on file.
curl -fsS "${GRAPH}/${WHATSAPP_META_APP_ID}/subscriptions" \
  --data-urlencode "access_token=${WHATSAPP_META_APP_ID}|${WHATSAPP_META_APP_SECRET}" -G
echo
echo "Done. Customers connect numbers from the dashboard; each connection subscribes this app to their WABA."
