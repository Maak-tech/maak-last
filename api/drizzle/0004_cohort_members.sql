CREATE TABLE "cohort_members" (
	"id" text PRIMARY KEY NOT NULL,
	"cohort_id" text NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"enrolled_by" text NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_members_unique_member" UNIQUE("cohort_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "cohort_members_cohort_idx" ON "cohort_members" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "cohort_members_org_idx" ON "cohort_members" USING btree ("org_id");