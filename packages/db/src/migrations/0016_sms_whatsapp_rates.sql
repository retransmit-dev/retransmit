CREATE TABLE "sms_rate" (
	"country" text PRIMARY KEY NOT NULL,
	"price_micros" integer NOT NULL,
	"cost_micros" integer,
	"source" text DEFAULT 'seed' NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_rate" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"category" text NOT NULL,
	"price_micros" integer NOT NULL,
	"cost_micros" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_rate" ADD CONSTRAINT "sms_rate_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_rate" ADD CONSTRAINT "whatsapp_rate_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "smsRate_source_idx" ON "sms_rate" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsappRate_country_category_uidx" ON "whatsapp_rate" USING btree ("country","category");