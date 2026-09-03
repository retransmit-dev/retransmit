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
ALTER TABLE "whatsapp_event" ADD CONSTRAINT "whatsapp_event_message_id_whatsapp_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."whatsapp_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_reply_to_message_id_whatsapp_message_id_fk" FOREIGN KEY ("reply_to_message_id") REFERENCES "public"."whatsapp_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsappEvent_messageId_idx" ON "whatsapp_event" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsappInbound_provider_providerMessageId_idx" ON "whatsapp_inbound" USING btree ("provider","provider_message_id");--> statement-breakpoint
CREATE INDEX "whatsappInbound_userId_createdAt_idx" ON "whatsapp_inbound" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsappMessage_userId_createdAt_idx" ON "whatsapp_message" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsappMessage_providerMessageId_idx" ON "whatsapp_message" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "whatsappMessage_userId_status_idx" ON "whatsapp_message" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "whatsappMessage_to_createdAt_idx" ON "whatsapp_message" USING btree ("to","created_at");