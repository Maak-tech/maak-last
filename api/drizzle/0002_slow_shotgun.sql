CREATE TABLE "care_pathways" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_condition" text,
	"steps" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinical_integration_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"requester_id" text,
	"patient_id" text,
	"integration_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"request_data" jsonb,
	"response_data" jsonb,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_adherence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"medication_id" text,
	"reminder_id" text,
	"status" text NOT NULL,
	"scheduled_at" timestamp,
	"taken_at" timestamp,
	"dose" text,
	"notes" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pathway_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"pathway_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"status" text DEFAULT 'active',
	"current_step_id" text,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"next_step_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX "care_pathways_org_idx" ON "care_pathways" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "clinical_integration_org_idx" ON "clinical_integration_requests" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "clinical_integration_patient_idx" ON "clinical_integration_requests" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "medication_adherence_user_idx" ON "medication_adherence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medication_adherence_med_idx" ON "medication_adherence" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "pathway_enrollments_org_idx" ON "pathway_enrollments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "pathway_enrollments_patient_idx" ON "pathway_enrollments" USING btree ("patient_id");