CREATE TABLE "anomalies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vital_type" text NOT NULL,
	"value" numeric,
	"baseline_value" numeric,
	"z_score" numeric,
	"severity" text DEFAULT 'warning',
	"is_acknowledged" boolean DEFAULT false,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"family_id" text,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"all_day" boolean DEFAULT false,
	"location" text,
	"recurrence_pattern" text,
	"recurrence_end_date" timestamp,
	"recurrence_count" integer,
	"related_item_id" text,
	"related_item_type" text,
	"color" text,
	"reminders" jsonb,
	"tags" text[] DEFAULT '{}',
	"attendees" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caregiver_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"caregiver_id" text NOT NULL,
	"caregiver_name" text,
	"note" text NOT NULL,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text,
	"user_id" text NOT NULL,
	"family_id" text,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'active',
	"current_level" integer DEFAULT 1,
	"acknowledged_by" text,
	"acknowledged_at" timestamp,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"notifications_sent" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_agent_state" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"state" jsonb,
	"last_agent_run_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppg_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"embeddings" jsonb NOT NULL,
	"heart_rate" numeric,
	"hrv" numeric,
	"respiratory_rate" numeric,
	"signal_quality" numeric NOT NULL,
	"confidence" numeric,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"assigned_to" text,
	"type" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"context" jsonb,
	"due_at" timestamp,
	"completed_at" timestamp,
	"completed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_baselines" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now(),
	"last_notification_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ALTER COLUMN "mood" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "sleep_quality" integer;--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "discharge_type" text;--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "spotting" boolean;--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "birth_control_method" text;--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "birth_control_taken" boolean;--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "birth_control_side_effects" text[];--> statement-breakpoint
ALTER TABLE "cycle_daily_entries" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD COLUMN "invited_user_name" text;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD COLUMN "invited_user_relation" text;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD COLUMN "used_at" timestamp;--> statement-breakpoint
ALTER TABLE "family_invitations" ADD COLUMN "used_by" text;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "reminders" jsonb;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "period_cycles" ADD COLUMN "flow_intensity" text;--> statement-breakpoint
ALTER TABLE "period_cycles" ADD COLUMN "symptoms" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb;--> statement-breakpoint
CREATE INDEX "anomalies_user_idx" ON "anomalies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anomalies_user_detected_idx" ON "anomalies" USING btree ("user_id","detected_at");--> statement-breakpoint
CREATE INDEX "cal_events_user_idx" ON "calendar_events" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "escalations_user_idx" ON "escalations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "escalations_family_idx" ON "escalations" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "notification_templates_org_idx" ON "notification_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ppg_embeddings_user_idx" ON "ppg_embeddings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_org_idx" ON "tasks" USING btree ("org_id","status");