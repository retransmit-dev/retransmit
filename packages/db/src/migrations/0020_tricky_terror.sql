CREATE TABLE "sms_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sms_sender_id" text NOT NULL,
	"phone" text NOT NULL,
	"purposes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"method" text NOT NULL,
	"source" text NOT NULL,
	"disclosure_text" text NOT NULL,
	"evidence_url" text,
	"consented_at" timestamp NOT NULL,
	"confirmed_at" timestamp,
	"opted_out_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_suppression" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"phone" text NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms" ADD COLUMN "sms_sender_id" text;--> statement-breakpoint
ALTER TABLE "sms" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "opt_in_url" text;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "privacy_url" text;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "terms_url" text;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "support_email" text;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "opt_out_text" text;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "purposes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "expected_daily_volume" integer;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "expected_monthly_volume" integer;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "daily_limit" integer;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "monthly_limit" integer;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD COLUMN "recipient_daily_limit" integer;--> statement-breakpoint
ALTER TABLE "sms_consent" ADD CONSTRAINT "sms_consent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_consent" ADD CONSTRAINT "sms_consent_sms_sender_id_sms_sender_id_fk" FOREIGN KEY ("sms_sender_id") REFERENCES "public"."sms_sender"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_suppression" ADD CONSTRAINT "sms_suppression_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "smsConsent_org_sender_phone_uidx" ON "sms_consent" USING btree ("organization_id","sms_sender_id","phone");--> statement-breakpoint
CREATE INDEX "smsConsent_organizationId_createdAt_idx" ON "sms_consent" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "smsSuppression_org_phone_uidx" ON "sms_suppression" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX "smsSuppression_organizationId_createdAt_idx" ON "sms_suppression" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "sms" ADD CONSTRAINT "sms_sms_sender_id_sms_sender_id_fk" FOREIGN KEY ("sms_sender_id") REFERENCES "public"."sms_sender"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_organizationId_senderId_createdAt_idx" ON "sms" USING btree ("organization_id","sms_sender_id","created_at");