CREATE TABLE "mailbox_domain" (
	"domain" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"mx_hosts" jsonb,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email" ADD COLUMN "bounce_reason" text;--> statement-breakpoint
ALTER TABLE "email" ADD COLUMN "recipient_provider" text;--> statement-breakpoint
CREATE INDEX "email_userId_recipientProvider_idx" ON "email" USING btree ("user_id","recipient_provider");