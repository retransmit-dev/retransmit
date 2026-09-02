CREATE TABLE "email_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"api_key_id" text,
	"total" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email" ADD COLUMN "batch_id" text;--> statement-breakpoint
ALTER TABLE "email_batch" ADD CONSTRAINT "email_batch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_batch" ADD CONSTRAINT "email_batch_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emailBatch_userId_createdAt_idx" ON "email_batch" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "email" ADD CONSTRAINT "email_batch_id_email_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."email_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_batchId_idx" ON "email" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "email_userId_status_idx" ON "email" USING btree ("user_id","status");