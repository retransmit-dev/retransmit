CREATE TABLE "billing_account" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'none' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"has_payment_method" boolean DEFAULT false NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"metric" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"reported_quantity" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_usage" ADD CONSTRAINT "billing_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billingAccount_stripeCustomerId_uidx" ON "billing_account" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billingAccount_stripeSubscriptionId_uidx" ON "billing_account" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billingUsage_org_metric_period_uidx" ON "billing_usage" USING btree ("organization_id","metric","period_start");--> statement-breakpoint
CREATE INDEX "billingUsage_unreported_idx" ON "billing_usage" USING btree ("organization_id","metric");