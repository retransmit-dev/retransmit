CREATE TABLE "whatsapp_account" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"source" text DEFAULT 'embedded_signup' NOT NULL,
	"waba_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"phone_number" text NOT NULL,
	"verified_name" text,
	"quality_rating" text,
	"access_token" text NOT NULL,
	"pin" text,
	"status" text DEFAULT 'active' NOT NULL,
	"error" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_event" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_inbound" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"user_id" text,
	"organization_id" text,
	"provider" text NOT NULL,
	"provider_message_id" text NOT NULL,
	"from" text NOT NULL,
	"to" text,
	"profile_name" text,
	"type" text NOT NULL,
	"text" text,
	"reply_to_message_id" text,
	"data" jsonb NOT NULL,
	"received_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"api_key_id" text,
	"account_id" text,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"country" text,
	"type" text DEFAULT 'text' NOT NULL,
	"text" text,
	"preview_url" boolean DEFAULT false NOT NULL,
	"template" jsonb,
	"media" jsonb,
	"provider" text,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"last_event_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_account" ADD CONSTRAINT "whatsapp_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_account" ADD CONSTRAINT "whatsapp_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_event" ADD CONSTRAINT "whatsapp_event_message_id_whatsapp_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."whatsapp_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_account_id_whatsapp_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_reply_to_message_id_whatsapp_message_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."whatsapp_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_account_id_whatsapp_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsappAccount_provider_phoneNumberId_idx" ON "whatsapp_account" USING btree ("provider","phone_number_id");--> statement-breakpoint
CREATE INDEX "whatsappAccount_organizationId_idx" ON "whatsapp_account" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "whatsappEvent_messageId_idx" ON "whatsapp_event" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsappInbound_provider_providerMessageId_idx" ON "whatsapp_inbound" USING btree ("provider","provider_message_id");--> statement-breakpoint
CREATE INDEX "whatsappInbound_accountId_createdAt_idx" ON "whatsapp_inbound" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsappMessage_userId_createdAt_idx" ON "whatsapp_message" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsappMessage_providerMessageId_idx" ON "whatsapp_message" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "whatsappMessage_userId_status_idx" ON "whatsapp_message" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "whatsappMessage_accountId_createdAt_idx" ON "whatsapp_message" USING btree ("account_id","created_at");