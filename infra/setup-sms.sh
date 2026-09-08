#!/usr/bin/env bash
#
# One-time (per region) setup of Retransmit's AWS End User Messaging SMS
# resources. These live in RETRANSMIT's AWS account — customers never touch
# AWS, they only request a sender id in the dashboard (SMS > Sender IDs) and
# an operator registers it here.
#
#   ./infra/setup-sms.sh                       # all four regions
#   ./infra/setup-sms.sh eu-central-1          # one region
#   SMS_SKIP_CALLBACK=1 ./infra/setup-sms.sh   # resources only (API not deployed yet)
#
# Per region it creates:
#   1. an SNS topic for SMS delivery events,
#   2. a topic policy letting End User Messaging publish to it,
#   3. an End User Messaging configuration set,
#   4. an event destination wiring the config set to the topic,
#   5. an HTTPS subscription from the topic to /v1/callbacks/sms/sns.
#
# Why a configuration set and not SNS Publish + CloudWatch: SNS SMS only
# reports delivery status into CloudWatch Logs, which cannot post to an HTTPS
# endpoint without a Lambda or Firehose in between. End User Messaging
# publishes events straight to an SNS topic, so the callback subscribes the
# same way it does for SES and there is no forwarder to own. Without a
# confirmed subscription every message stays at "sent" forever, so the script
# probes the endpoint, subscribes, waits for confirmation and exits non-zero
# if it does not happen.
#
# What it deliberately does NOT do, because AWS does not expose it as an API:
#   - leaving the SMS sandbox (a support case, per region; until then sends
#     only reach verified destination numbers under a ~$1/month cap),
#   - raising the monthly spend limit (a support case),
#   - registering a sender id or buying a number (per country, carrier review).
# The script reports the sandbox and spend-limit state of each region at the
# end so it is obvious which ones are not usable yet.
#
# Safe to re-run: every step is idempotent.
set -euo pipefail

CONFIG_SET="${SMS_CONFIGURATION_SET:-retransmit-sms-events}"
TOPIC_NAME="${SMS_TOPIC_NAME:-retransmit-sms-events}"
CALLBACK_BASE="${SMS_CALLBACK_URL:-https://api.retransmit.dev/v1/callbacks/sms/sns}"
DEFAULT_REGIONS="eu-central-1 us-east-1 ap-southeast-1 af-south-1"
REGIONS=("${@:-$DEFAULT_REGIONS}")
# shellcheck disable=SC2206
REGIONS=(${REGIONS[@]})

# The callback authenticates with the shared token the carriers also use, as
# a query string. Without it in .env the endpoint accepts anything, which is
# only acceptable in dev.
CALLBACK_URL="$CALLBACK_BASE"
if [ -n "${SMS_CALLBACK_TOKEN:-}" ]; then
  CALLBACK_URL="${CALLBACK_BASE}?token=${SMS_CALLBACK_TOKEN}"
else
  echo "WARNING: SMS_CALLBACK_TOKEN is not set; subscribing an unauthenticated callback." >&2
fi
if [ "${SMS_SKIP_CALLBACK:-}" = "1" ]; then CALLBACK_URL=""; fi

# Events worth recording. The in-flight ones (TEXT_PENDING, TEXT_QUEUED,
# TEXT_SENT) are left out: the row is already "sent" by the time they arrive,
# so they would be delivered and then ignored.
EVENT_TYPES='["TEXT_DELIVERED","TEXT_SUCCESSFUL","TEXT_INVALID","TEXT_INVALID_MESSAGE","TEXT_UNREACHABLE","TEXT_CARRIER_UNREACHABLE","TEXT_BLOCKED","TEXT_CARRIER_BLOCKED","TEXT_SPAM","TEXT_UNKNOWN","TEXT_TTL_EXPIRED"]'

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $ACCOUNT_ID"
echo "Regions: ${REGIONS[*]}"
echo

SUMMARY=""

for REGION in "${REGIONS[@]}"; do
  echo "=== $REGION ==="

  # 1. SNS topic (create-topic is idempotent and returns the existing ARN)
  TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$REGION" \
    --query TopicArn --output text)
  echo "Topic: $TOPIC_ARN"

  # 2. Let End User Messaging publish to it, and nobody else
  aws sns set-topic-attributes --topic-arn "$TOPIC_ARN" --region "$REGION" \
    --attribute-name Policy --attribute-value "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OwnerAccess",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::${ACCOUNT_ID}:root" },
      "Action": [
        "SNS:GetTopicAttributes",
        "SNS:SetTopicAttributes",
        "SNS:AddPermission",
        "SNS:RemovePermission",
        "SNS:DeleteTopic",
        "SNS:Subscribe",
        "SNS:ListSubscriptionsByTopic",
        "SNS:Publish"
      ],
      "Resource": "${TOPIC_ARN}"
    },
    {
      "Sid": "AllowEndUserMessagingPublish",
      "Effect": "Allow",
      "Principal": { "Service": "sms-voice.amazonaws.com" },
      "Action": "SNS:Publish",
      "Resource": "${TOPIC_ARN}",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "${ACCOUNT_ID}" }
      }
    }
  ]
}
JSON
)"
  echo "Topic policy set (End User Messaging may publish)"

  # 3. Configuration set
  if aws pinpoint-sms-voice-v2 describe-configuration-sets \
    --configuration-set-names "$CONFIG_SET" --region "$REGION" >/dev/null 2>&1; then
    echo "Configuration set '$CONFIG_SET' already exists"
  else
    aws pinpoint-sms-voice-v2 create-configuration-set \
      --configuration-set-name "$CONFIG_SET" --region "$REGION" >/dev/null
    echo "Configuration set '$CONFIG_SET' created"
  fi

  # 4. Event destination: SMS events -> SNS topic
  if aws pinpoint-sms-voice-v2 create-event-destination \
    --configuration-set-name "$CONFIG_SET" \
    --event-destination-name sns-events \
    --matching-event-types "$EVENT_TYPES" \
    --sns-destination "TopicArn=$TOPIC_ARN" \
    --region "$REGION" >/dev/null 2>&1; then
    echo "Event destination created"
  else
    aws pinpoint-sms-voice-v2 update-event-destination \
      --configuration-set-name "$CONFIG_SET" \
      --event-destination-name sns-events \
      --enabled \
      --matching-event-types "$EVENT_TYPES" \
      --sns-destination "TopicArn=$TOPIC_ARN" \
      --region "$REGION" >/dev/null
    echo "Event destination updated"
  fi

  # 5. Subscribe the API callback (needs the deployed endpoint to confirm)
  if [ -n "$CALLBACK_URL" ]; then
    # Preflight: the route answers 200 to a notification it cannot apply.
    # Anything else means the API is not deployed there and the subscription
    # would sit in PendingConfirmation.
    PROBE_STATUS=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' -X POST "$CALLBACK_URL" \
      -H 'content-type: application/json' \
      -d "{\"Type\":\"Notification\",\"TopicArn\":\"${TOPIC_ARN}\",\"Message\":\"{}\"}" || echo 000)
    if [ "$PROBE_STATUS" != "200" ]; then
      echo "ERROR: $CALLBACK_BASE answered HTTP $PROBE_STATUS to a test notification." >&2
      echo "       Deploy apps/api (and check SMS_CALLBACK_TOKEN matches), then re-run." >&2
      exit 1
    fi

    aws sns subscribe --topic-arn "$TOPIC_ARN" --region "$REGION" \
      --protocol https --notification-endpoint "$CALLBACK_URL" \
      --query SubscriptionArn --output text >/dev/null

    SUB_ARN=""
    for _ in $(seq 1 12); do
      SUB_ARN=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --region "$REGION" \
        --query "Subscriptions[?Endpoint=='${CALLBACK_URL}' && Protocol=='https' && SubscriptionArn!='PendingConfirmation'].SubscriptionArn | [0]" \
        --output text)
      if [ -n "$SUB_ARN" ] && [ "$SUB_ARN" != "None" ]; then break; fi
      sleep 5
    done
    if [ -z "$SUB_ARN" ] || [ "$SUB_ARN" = "None" ]; then
      echo "ERROR: subscription for $CALLBACK_BASE is still pending confirmation." >&2
      echo "       Check the API logs for the SubscriptionConfirmation request." >&2
      exit 1
    fi
    echo "Callback subscribed and confirmed: $SUB_ARN"
  else
    echo "Skipped callback subscription (SMS_SKIP_CALLBACK=1)."
    echo "WARNING: without it every message stays at 'sent'. Re-run once apps/api is deployed."
  fi

  # Report what still needs a human: sandbox status and spend limit.
  SANDBOX=$(aws pinpoint-sms-voice-v2 describe-account-attributes --region "$REGION" \
    --query "AccountAttributes[?Name=='ACCOUNT_TIER'].Value | [0]" --output text 2>/dev/null || echo unknown)
  LIMIT=$(aws pinpoint-sms-voice-v2 describe-spend-limits --region "$REGION" \
    --query "SpendLimits[?Name=='TEXT_MESSAGE_MONTHLY_SPEND_LIMIT'].EnforcedLimit | [0]" \
    --output text 2>/dev/null || echo unknown)
  IDENTITIES=$(aws pinpoint-sms-voice-v2 describe-sender-ids --region "$REGION" \
    --query "length(SenderIds)" --output text 2>/dev/null || echo 0)
  echo "Account tier: $SANDBOX   Monthly spend limit: \$$LIMIT   Sender ids: $IDENTITIES"
  SUMMARY="${SUMMARY}  ${REGION}: tier=${SANDBOX} spend_limit=\$${LIMIT} sender_ids=${IDENTITIES}\n"
  echo
done

echo "Per-region state:"
printf "%b" "$SUMMARY"
echo
echo "Add to .env (pick the region sends should originate from):"
echo "  SNS_SMS_REGION=${REGIONS[0]}"
echo "  SNS_SMS_CONFIGURATION_SET=$CONFIG_SET"
echo
echo "Still manual, per region, before real traffic:"
echo "  - tier=SANDBOX means only verified destination numbers receive messages."
echo "    Request production access in the End User Messaging console (support case)."
echo "  - Raise the monthly spend limit in the same case."
echo "  - Register a sender id per country as requests come in (SMS > Sender IDs"
echo "    in the dashboard is the queue):"
echo "      aws pinpoint-sms-voice-v2 describe-sender-ids --region <region>"
