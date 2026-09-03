ALTER TABLE "email" ADD COLUMN "tags" jsonb;--> statement-breakpoint
CREATE INDEX "email_tags_gin_idx" ON "email" USING gin ("tags");