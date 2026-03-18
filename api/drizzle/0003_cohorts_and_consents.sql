CREATE TABLE "cohorts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"condition" text,
	"program" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"granted_by" text NOT NULL,
	"grant_method" text NOT NULL,
	"scope" text[] DEFAULT '{}',
	"version" text DEFAULT '1.0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "cohorts_org_idx" ON "cohorts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "patient_consents_user_idx" ON "patient_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "patient_consents_org_idx" ON "patient_consents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "patient_consents_user_org_idx" ON "patient_consents" USING btree ("user_id","org_id");--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_unique_member" UNIQUE("family_id","user_id");--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_unique_member" UNIQUE("org_id","user_id");--> statement-breakpoint
ALTER TABLE "patient_rosters" ADD CONSTRAINT "patient_rosters_unique_enrollment" UNIQUE("org_id","user_id");--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_token_unique" UNIQUE("token");