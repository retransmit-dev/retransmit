ALTER TABLE "email" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
CREATE INDEX "email_scheduledAt_idx" ON "email" USING btree ("scheduled_at");