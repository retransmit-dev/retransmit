#!/usr/bin/env bash
#
# One-time setup of the S3 buckets that hold email attachments. One bucket
# per SES region so the send worker reads attachment bytes from the region
# the sending domain was verified in (see packages/email/src/regions.ts).
#
#   ./infra/setup-attachments.sh                 # all four SES regions
#   ./infra/setup-attachments.sh eu-central-1    # one region
#
# Bucket name: ${ATTACHMENTS_BUCKET_PREFIX}-${region}. The prefix carries a
# random suffix because bucket names are global; keep it in .env.
#
# Every bucket: public access blocked, ACLs disabled, SSE-S3 encryption,
# and a lifecycle rule that deletes every object 30 days after upload and
# aborts incomplete multipart uploads after one day. Attachments are only
# needed until the queued send goes out; the 30 days are for the dashboard
# download link. The email_attachment row (filename, size, type) outlives
# the object.
#
# Safe to re-run: every step is idempotent.
set -euo pipefail

PREFIX="${ATTACHMENTS_BUCKET_PREFIX:?set ATTACHMENTS_BUCKET_PREFIX, e.g. retransmit-attachments-qatg7v}"
REGIONS=("${@:-eu-central-1 us-east-1 ap-southeast-1 af-south-1}")
# shellcheck disable=SC2206
REGIONS=(${REGIONS[@]})

LIFECYCLE='{"Rules":[{"ID":"expire-attachments-30d","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"Days":30},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

for region in "${REGIONS[@]}"; do
  bucket="${PREFIX}-${region}"
  if aws s3api head-bucket --bucket "$bucket" --region "$region" >/dev/null 2>&1; then
    echo "Bucket $bucket already exists"
  elif [ "$region" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$bucket" --region "$region" >/dev/null
    echo "Bucket $bucket created"
  else
    aws s3api create-bucket --bucket "$bucket" --region "$region" \
      --create-bucket-configuration LocationConstraint="$region" >/dev/null
    echo "Bucket $bucket created"
  fi

  aws s3api put-public-access-block --bucket "$bucket" --region "$region" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-ownership-controls --bucket "$bucket" --region "$region" \
    --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'
  aws s3api put-bucket-encryption --bucket "$bucket" --region "$region" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
  aws s3api put-bucket-lifecycle-configuration --bucket "$bucket" --region "$region" \
    --lifecycle-configuration "$LIFECYCLE" >/dev/null
  echo "  private, encrypted, 30-day expiry"
done

echo
echo "Add to .env:"
echo "  ATTACHMENTS_BUCKET_PREFIX=$PREFIX"
