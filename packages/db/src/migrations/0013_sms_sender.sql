CREATE TABLE "sms_sender" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"use_case" text NOT NULL,
	"sample_message" text NOT NULL,
	"company_name" text NOT NULL,
	"company_website" text,
	"registration_id" text,
	"review_note" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_sender" ADD CONSTRAINT "sms_sender_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_sender" ADD CONSTRAINT "sms_sender_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "smsSender_org_senderId_uidx" ON "sms_sender" USING btree ("organization_id","sender_id");--> statement-breakpoint
CREATE INDEX "smsSender_organizationId_idx" ON "sms_sender" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "smsSender_status_idx" ON "sms_sender" USING btree ("status");