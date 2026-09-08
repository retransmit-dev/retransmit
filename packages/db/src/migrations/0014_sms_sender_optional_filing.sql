ALTER TABLE "sms_sender" ALTER COLUMN "use_case" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_sender" ALTER COLUMN "sample_message" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_sender" ALTER COLUMN "company_name" DROP NOT NULL;