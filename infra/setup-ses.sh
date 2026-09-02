#!/usr/bin/env bash
#
# One-time (per region) setup of Retransmit's platform SES resources.
# These live in RETRANSMIT's AWS account — customers never touch SES/SNS,
# they only publish the DKIM DNS records for their own domain.
#
#   ./infra/setup-ses.sh                  # topic + config set + subscribe prod callback
#   ./infra/setup-ses.sh https://staging.example/v1/callbacks/ses
#                                         # ...subscribe a different callback
#   SES_SKIP_CALLBACK=1 ./infra/setup-ses.sh
#                                         # ...create resources only (API not deployed yet)
#
# The callback subscription only confirms once apps/api is deployed and
# reachable at that URL (the route auto-confirms the SNS subscription).
# Without a confirmed subscription SES publishes delivery/bounce events
# into the void and every email stays at "sent" forever, so the script
# probes the endpoint, subscribes, then waits for confirmation and exits
# non-zero if it does not happen.
#
# Safe to re-run: every step is idempotent.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
CONFIG_SET="${SES_CONFIGURATION_SET:-retransmit-events}"
TOPIC_NAME="${SES_TOPIC_NAME:-retransmit-ses-events}"
CALLBACK_URL="${1:-${SES_CALLBACK_URL:-https://api.retransmit.dev/v1/callbacks/ses}}"
if [ "${SES_SKIP_CALLBACK:-}" = "1" ]; then CALLBACK_URL=""; fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Account: $ACCOUNT_ID  Region: $REGION"

# 1. SNS topic (create-topic is idempotent)
TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$REGION" \
  --query TopicArn --output text)
echo "Topic: $TOPIC_ARN"

# 2. Allow this account's SES configuration set to publish to the topic
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
      "Sid": "AllowSesPublish",
      "Effect": "Allow",
      "Principal": { "Service": "ses.amazonaws.com" },
      "Action": "SNS:Publish",
      "Resource": "${TOPIC_ARN}",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "${ACCOUNT_ID}" },
        "ArnLike": {
          "aws:SourceArn": "arn:aws:ses:${REGION}:${ACCOUNT_ID}:configuration-set/${CONFIG_SET}"
        }
      }
    }
  ]
}
JSON
)"
echo "Topic policy set (SES may publish)"

# 3. Configuration set
if aws sesv2 get-configuration-set --configuration-set-name "$CONFIG_SET" \
  --region "$REGION" >/dev/null 2>&1; then
  echo "Configuration set '$CONFIG_SET' already exists"
else
  aws sesv2 create-configuration-set --configuration-set-name "$CONFIG_SET" --region "$REGION"
  echo "Configuration set '$CONFIG_SET' created"
fi

# 4. Event destination: SES events -> SNS topic
DESTINATION=$(cat <<JSON
{
  "Enabled": true,
  "MatchingEventTypes": ["DELIVERY", "DELIVERY_DELAY", "OPEN", "CLICK", "BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE"],
  "SnsDestination": { "TopicArn": "${TOPIC_ARN}" }
}
JSON
)
if aws sesv2 create-configuration-set-event-destination \
  --configuration-set-name "$CONFIG_SET" \
  --event-destination-name sns-events \
  --event-destination "$DESTINATION" \
  --region "$REGION" >/dev/null 2>&1; then
  echo "Event destination created"
else
  aws sesv2 update-configuration-set-event-destination \
    --configuration-set-name "$CONFIG_SET" \
    --event-destination-name sns-events \
    --event-destination "$DESTINATION" \
    --region "$REGION"
  echo "Event destination updated"
fi

# 5. Subscribe the API callback (needs the deployed endpoint to confirm)
if [ -n "$CALLBACK_URL" ]; then
  # Preflight: the route answers 200 {"status":"ignored"} to an empty
  # notification for its own topic. Anything else means the API is not
  # deployed there (or SES_SNS_TOPIC_ARN is wrong on the server) and the
  # subscription would sit in PendingConfirmation.
  PROBE_STATUS=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' -X POST "$CALLBACK_URL" \
    -H 'content-type: application/json' \
    -d "{\"Type\":\"Notification\",\"TopicArn\":\"${TOPIC_ARN}\",\"Message\":\"{}\"}" || echo 000)
  if [ "$PROBE_STATUS" != "200" ]; then
    echo "ERROR: $CALLBACK_URL answered HTTP $PROBE_STATUS to a test notification." >&2
    echo "       Deploy apps/api with SES_SNS_TOPIC_ARN=$TOPIC_ARN, then re-run." >&2
    exit 1
  fi

  # subscribe is idempotent for the same protocol+endpoint; it returns the
  # existing ARN, or "pending confirmation" while SNS waits for the callback.
  aws sns subscribe --topic-arn "$TOPIC_ARN" --region "$REGION" \
    --protocol https --notification-endpoint "$CALLBACK_URL" \
    --query SubscriptionArn --output text >/dev/null

  # The callback fetches SubscribeURL as soon as SNS calls it; give it a
  # few seconds and then insist on a confirmed subscription.
  SUB_ARN=""
  for _ in $(seq 1 12); do
    SUB_ARN=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --region "$REGION" \
      --query "Subscriptions[?Endpoint=='${CALLBACK_URL}' && Protocol=='https' && SubscriptionArn!='PendingConfirmation'].SubscriptionArn | [0]" \
      --output text)
    if [ -n "$SUB_ARN" ] && [ "$SUB_ARN" != "None" ]; then break; fi
    sleep 5
  done
  if [ -z "$SUB_ARN" ] || [ "$SUB_ARN" = "None" ]; then
    echo "ERROR: subscription for $CALLBACK_URL is still pending confirmation." >&2
    echo "       Check the API logs for the SubscriptionConfirmation request." >&2
    exit 1
  fi
  echo "Callback subscribed and confirmed: $SUB_ARN"
else
  echo "Skipped callback subscription (SES_SKIP_CALLBACK=1)."
  echo "WARNING: without it, delivery/bounce events are dropped. Re-run without the flag once apps/api is deployed."
fi

echo
echo "Add to .env:"
echo "  SES_CONFIGURATION_SET=$CONFIG_SET"
echo "  SES_SNS_TOPIC_ARN=$TOPIC_ARN"
