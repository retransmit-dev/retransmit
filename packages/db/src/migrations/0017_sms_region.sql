ALTER TABLE "sms" ADD COLUMN "region" text;--> statement-breakpoint
-- Existing sender ids were registered under the single deployment-wide
-- SNS_SMS_REGION. Backfill with it, then drop the default so every new row
-- has to name the region it was actually registered in.
ALTER TABLE "sms_sender" ADD COLUMN "region" text DEFAULT 'eu-central-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_sender" ALTER COLUMN "region" DROP DEFAULT;
