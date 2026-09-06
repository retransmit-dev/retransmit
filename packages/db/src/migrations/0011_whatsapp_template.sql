CREATE TABLE "whatsapp_template" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"account_id" text,
	"provider" text NOT NULL,
	"waba_id" text NOT NULL,
	"provider_template_id" text,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejected_reason" text,
	"components" jsonb NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_template" ADD CONSTRAINT "whatsapp_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_template" ADD CONSTRAINT "whatsapp_template_account_id_whatsapp_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."whatsapp_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsappTemplate_provider_wabaId_name_language_idx" ON "whatsapp_template" USING btree ("provider","waba_id","name","language");--> statement-breakpoint
CREATE INDEX "whatsappTemplate_organizationId_idx" ON "whatsapp_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "whatsappTemplate_providerTemplateId_idx" ON "whatsapp_template" USING btree ("provider_template_id");