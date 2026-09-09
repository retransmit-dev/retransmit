#!/usr/bin/env bash
#
# Creates Retransmit's Stripe product catalog: the three plans, the metered
# prices behind them, and the billing meters those prices read.
#
#   ./infra/setup-stripe.sh                 # uses STRIPE_SECRET_KEY from .env
#   STRIPE_SECRET_KEY=sk_test_... ./infra/setup-stripe.sh
#
# What it creates:
#
#   3 meters       retransmit_emails / retransmit_sms / retransmit_whatsapp
#   5 products     one per plan (Free, Pro, Business) plus SMS and WhatsApp
#   8 prices       a flat monthly price per plan, a graduated email price per
#                  plan, and one metered price each for SMS and WhatsApp
#   1 portal config  so customers can switch plan and manage cards themselves
#
# Why email overage is a price on the *plan* product and not its own product:
# the included allowance and the overage rate are two tiers of the same thing.
# A graduated price with tier 1 at $0 up to the allowance bills exactly the
# table: 50K included on Pro, then $0.18/1K. One subscription therefore has two
# items (flat + email), plus SMS and WhatsApp items once those are used.
#
# Meter units. Emails are metered one event per recipient. SMS and WhatsApp
# cost different amounts per country, and a Stripe price cannot vary by
# destination, so those two meters record *money*, not messages: one unit is
# USD 0.0001 (a hundredth of a cent). packages/billing/src/rates.ts turns a
# destination into units. That keeps the rate card in code, where it can differ
# per country, while Stripe still does the rating and invoicing.
#
# Prices are immutable, so re-running never edits one: it reuses the price
# carrying the lookup key and only creates what is missing. Safe to re-run.
# To change a rate, retire the lookup key (this script moves it) and let the
# script mint a new price; existing subscriptions keep the old one until they
# are migrated.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${STRIPE_SECRET_KEY:-}" && -f "$ROOT/.env" ]]; then
  STRIPE_SECRET_KEY="$(grep -E '^STRIPE_SECRET_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
fi
if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "STRIPE_SECRET_KEY is not set and .env has no STRIPE_SECRET_KEY" >&2
  exit 1
fi
export STRIPE_API_KEY="$STRIPE_SECRET_KEY"

api() { # api <method> <path> [curl args...]
  local method="$1" path="$2"
  shift 2
  curl -sS -X "$method" "https://api.stripe.com$path" -u "$STRIPE_SECRET_KEY:" "$@"
}

die_on_error() { # die_on_error <json> <what>
  if echo "$1" | jq -e '.error' >/dev/null 2>&1; then
    echo "  ! $2 failed: $(echo "$1" | jq -r '.error.message')" >&2
    exit 1
  fi
}

account="$(api GET /v1/account)"
die_on_error "$account" "reading the account"
echo "Stripe account: $(echo "$account" | jq -r '.id') ($(echo "$account" | jq -r '.business_profile.name // "unnamed"'))"
case "$STRIPE_SECRET_KEY" in
  sk_live_*|rk_live_*) echo "  ! this is a LIVE key; refusing to seed a catalog automatically" >&2; exit 1 ;;
esac
echo

# ---------------------------------------------------------------- meters ----

ensure_meter() { # ensure_meter <event_name> <display_name>  -> prints meter id
  local event="$1" name="$2" existing
  existing="$(api GET "/v1/billing/meters?limit=100&status=active" |
    jq -r --arg e "$event" '.data[] | select(.event_name == $e) | .id' | head -1)"
  if [[ -n "$existing" ]]; then
    echo "  = meter $event -> $existing" >&2
    echo "$existing"
    return
  fi
  local created
  created="$(api POST /v1/billing/meters \
    -d "display_name=$name" \
    -d "event_name=$event" \
    -d "default_aggregation[formula]=sum" \
    -d "value_settings[event_payload_key]=value" \
    -d "customer_mapping[type]=by_id" \
    -d "customer_mapping[event_payload_key]=stripe_customer_id")"
  die_on_error "$created" "creating meter $event"
  echo "  + meter $event -> $(echo "$created" | jq -r .id)" >&2
  echo "$created" | jq -r .id
}

echo "Meters"
METER_EMAIL="$(ensure_meter retransmit_emails "Emails sent")"
METER_SMS="$(ensure_meter retransmit_sms "SMS usage (USD 0.0001 units)")"
METER_WHATSAPP="$(ensure_meter retransmit_whatsapp "WhatsApp usage (USD 0.0001 units)")"
echo

# -------------------------------------------------------------- products ----

ensure_product() { # ensure_product <id> <name> <description>
  local id="$1" name="$2" description="$3" existing
  existing="$(api GET "/v1/products/$id")"
  if echo "$existing" | jq -e '.id' >/dev/null 2>&1; then
    echo "  = product $id" >&2
    echo "$id"
    return
  fi
  local created
  created="$(api POST /v1/products \
    -d "id=$id" -d "name=$name" -d "description=$description" \
    -d "metadata[retransmit]=true")"
  die_on_error "$created" "creating product $id"
  echo "  + product $id" >&2
  echo "$id"
}

echo "Products"
ensure_product retransmit_free "Retransmit Free" "1K emails included, 1 domain, 1 day of logs." >/dev/null
ensure_product retransmit_pro "Retransmit Pro" "50K emails included, 10 domains, 30 days of logs, 5 team members." >/dev/null
ensure_product retransmit_business "Retransmit Business" "200K emails included, 50 domains, 90 days of logs, 20 team members." >/dev/null
ensure_product retransmit_sms "Retransmit SMS" "Pay as you go SMS, billed per message at the destination rate." >/dev/null
ensure_product retransmit_whatsapp "Retransmit WhatsApp" "Pay as you go WhatsApp, billed per message at the destination rate." >/dev/null
echo

# ---------------------------------------------------------------- prices ----

price_id_for() { # price_id_for <lookup_key>
  api GET "/v1/prices?limit=100&active=true&lookup_keys[]=$1" | jq -r '.data[0].id // empty'
}

ensure_price() { # ensure_price <lookup_key> <nickname> <product> [extra -d args...]
  local key="$1" nickname="$2" product="$3" existing
  shift 3
  existing="$(price_id_for "$key")"
  if [[ -n "$existing" ]]; then
    echo "  = price $key -> $existing" >&2
    echo "$existing"
    return
  fi
  local created
  created="$(api POST /v1/prices \
    -d "currency=usd" -d "product=$product" \
    -d "lookup_key=$key" -d "transfer_lookup_key=true" \
    -d "nickname=$nickname" \
    -d "recurring[interval]=month" \
    "$@")"
  die_on_error "$created" "creating price $key"
  echo "  + price $key -> $(echo "$created" | jq -r .id)" >&2
  echo "$created" | jq -r .id
}

# Flat monthly platform fee. Free is a real $0 price so that every paying and
# non-paying organization has the same subscription shape and an upgrade is a
# price swap rather than a new subscription.
echo "Plan prices"
ensure_price plan_free_monthly "Free" retransmit_free -d "unit_amount=0" >/dev/null
ensure_price plan_pro_monthly "Pro" retransmit_pro -d "unit_amount=3900" >/dev/null
ensure_price plan_business_monthly "Business" retransmit_business -d "unit_amount=9900" >/dev/null
echo

# Graduated email price: tier 1 is the included allowance at $0, tier 2 is the
# overage rate. unit_amount_decimal is cents per email, so $0.18 per 1,000 is
# 0.018 cents each.
ensure_email_price() { # ensure_email_price <key> <nickname> <product> <included> <cents_per_email>
  ensure_price "$1" "$2" "$3" \
    -d "recurring[usage_type]=metered" \
    -d "recurring[meter]=$METER_EMAIL" \
    -d "billing_scheme=tiered" \
    -d "tiers_mode=graduated" \
    -d "tiers[0][up_to]=$4" \
    -d "tiers[0][unit_amount]=0" \
    -d "tiers[1][up_to]=inf" \
    -d "tiers[1][unit_amount_decimal]=$5" >/dev/null
}

echo "Email prices (included allowance + overage)"
ensure_email_price email_free "Emails (Free): 1K included, then \$0.25/1K" retransmit_free 1000 0.025
ensure_email_price email_pro "Emails (Pro): 50K included, then \$0.18/1K" retransmit_pro 50000 0.018
ensure_email_price email_business "Emails (Business): 200K included, then \$0.16/1K" retransmit_business 200000 0.016
echo

echo "Pay as you go prices"
ensure_price sms_usage "SMS (1 unit = \$0.0001)" retransmit_sms \
  -d "recurring[usage_type]=metered" \
  -d "recurring[meter]=$METER_SMS" \
  -d "unit_amount_decimal=0.01" >/dev/null
ensure_price whatsapp_usage "WhatsApp (1 unit = \$0.0001)" retransmit_whatsapp \
  -d "recurring[usage_type]=metered" \
  -d "recurring[meter]=$METER_WHATSAPP" \
  -d "unit_amount_decimal=0.01" >/dev/null
echo

# --------------------------------------------------------- portal config ----
#
# The portal owns cards, invoices, tax ids and cancellation. It deliberately
# does NOT own plan switching: a portal configuration only accepts per-unit
# licensed prices, so it would swap the flat price and leave the old email
# price behind, giving an upgraded customer the Free allowance. The dashboard
# changes plans instead (packages/billing/src/subscription.ts), swapping both
# items in one call.

echo "Customer portal"
portal_args=(
  -d "business_profile[headline]=Retransmit billing"
  -d "business_profile[privacy_policy_url]=https://retransmit.dev/privacy"
  -d "business_profile[terms_of_service_url]=https://retransmit.dev/terms"
  -d "features[customer_update][enabled]=true"
  -d "features[customer_update][allowed_updates][]=email"
  -d "features[customer_update][allowed_updates][]=address"
  -d "features[customer_update][allowed_updates][]=tax_id"
  -d "features[invoice_history][enabled]=true"
  -d "features[payment_method_update][enabled]=true"
  -d "features[subscription_cancel][enabled]=true"
  -d "features[subscription_cancel][mode]=at_period_end"
  -d "features[subscription_update][enabled]=false"
  -d "metadata[retransmit]=catalog"
)

existing_portal="$(api GET "/v1/billing_portal/configurations?limit=100&active=true" |
  jq -r '.data[] | select(.metadata.retransmit == "catalog") | .id' | head -1)"
if [[ -n "$existing_portal" ]]; then
  updated="$(api POST "/v1/billing_portal/configurations/$existing_portal" "${portal_args[@]}")"
  die_on_error "$updated" "updating the portal configuration"
  echo "  = portal configuration $existing_portal (updated)"
else
  created="$(api POST /v1/billing_portal/configurations "${portal_args[@]}")"
  die_on_error "$created" "creating the portal configuration"
  echo "  + portal configuration $(echo "$created" | jq -r .id)"
fi
echo

echo "Done. Prices are resolved at runtime by lookup key, so nothing here needs"
echo "to be copied into .env. Still to do by hand, because Stripe has no API for it:"
echo "  - Stripe Tax: add a registration before turning automatic_tax on"
echo "    (https://dashboard.stripe.com/test/tax/registrations), otherwise no tax is collected"
echo "  - production: run this against the live key once the plans are final"
echo
# The endpoint is created by hand because its signing secret has to be copied
# into STRIPE_WEBHOOK_SECRET anyway. Keep this list in step with
# HANDLED_EVENTS in packages/billing/src/webhook.ts.
echo "Webhook endpoint (dashboard > Developers > Webhooks), POST to"
echo "<api>/v1/callbacks/stripe, subscribed to:"
echo "  checkout.session.completed"
echo "  customer.subscription.created, .updated, .deleted, .paused, .resumed"
echo "  invoice.paid, invoice.payment_failed"
echo "  customer.updated, payment_method.attached, payment_method.detached"
echo "Then copy the signing secret into STRIPE_WEBHOOK_SECRET."
