CREATE TABLE "sms" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"api_key_id" text,
	"from" text,
	"to" jsonb NOT NULL,
	"text" text NOT NULL,
	"country" text,
	"segments" integer DEFAULT 1 NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"last_event_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_event" (
	"id" text PRIMARY KEY NOT NULL,
	"sms_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email" ADD COLUMN "marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sms" ADD CONSTRAINT "sms_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms" ADD CONSTRAINT "sms_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms" ADD CONSTRAINT "sms_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_event" ADD CONSTRAINT "sms_event_sms_id_sms_id_fk" FOREIGN KEY ("sms_id") REFERENCES "public"."sms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_userId_createdAt_idx" ON "sms" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sms_providerMessageId_idx" ON "sms" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "sms_userId_status_idx" ON "sms" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "smsEvent_smsId_idx" ON "sms_event" USING btree ("sms_id");