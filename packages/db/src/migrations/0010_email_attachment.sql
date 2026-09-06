CREATE TABLE "email_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"email_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"content_id" text,
	"inline" boolean DEFAULT false NOT NULL,
	"storage_region" text NOT NULL,
	"storage_key" text NOT NULL,
	"source_url" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_attachment" ADD CONSTRAINT "email_attachment_email_id_email_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."email"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emailAttachment_emailId_idx" ON "email_attachment" USING btree ("email_id");