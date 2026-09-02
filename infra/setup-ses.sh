#!/usr/bin/env bash
#
# One-time (per region) setup of Retransmit's platform SES resources.
# These live in RETRANSMIT's AWS account — customers never touch SES/SNS,
# they only publish the DKIM DNS records for their own domain.
#
#   ./infra/setup-ses.sh                                   # create topic + config set
#   ./infra/setup-ses.sh https://api.retransmit.dev/v1/callbacks/ses
#                                                          # ...and subscribe the callback
#
# The callback subscription only succeeds once apps/api is deployed and
# reachable at that URL (it auto-confirms the SNS subscription), so run
# the script again with the URL after the first deploy.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
CONFIG_SET="${SES_CONFIGURATION_SET:-retransmit-events}"
TOPIC_NAME="${SES_TOPIC_NAME:-retransmit-ses-events}"
CALLBACK_URL="${1:-}"

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
  "MatchingEventTypes": ["DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE"],
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
  aws sns subscribe --topic-arn "$TOPIC_ARN" --region "$REGION" \
    --protocol https --notification-endpoint "$CALLBACK_URL" \
    --query SubscriptionArn --output text
  echo "Subscription requested; the callback confirms it automatically."
else
  echo "Skipped callback subscription (pass the URL once apps/api is deployed)."
fi

echo
echo "Add to .env:"
echo "  SES_CONFIGURATION_SET=$CONFIG_SET"
echo "  SES_SNS_TOPIC_ARN=$TOPIC_ARN"
