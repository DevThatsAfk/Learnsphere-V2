/*
  Warnings:

  - Added the required column `user_id` to the `exams` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "RiskFlagType" AS ENUM ('LOW_ATTENDANCE', 'POOR_MARKS', 'STUDY_NEGLECT', 'WEAK_RECALL', 'LOW_LMS_ACTIVITY', 'BEHAVIOURAL_DROP', 'CONSECUTIVE_ABSENCES');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'MODIFIED_SENT', 'ACKNOWLEDGED', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LMSSource" AS ENUM ('MOODLE', 'GOOGLE_CLASSROOM', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'PARENT';
ALTER TYPE "UserRole" ADD VALUE 'EDUCATOR';
ALTER TYPE "UserRole" ADD VALUE 'ADVISOR';
ALTER TYPE "UserRole" ADD VALUE 'HOD';

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "roll_number" TEXT,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "year_of_study" INTEGER;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hod_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_student_links" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'guardian',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisor_assignments" (
    "id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counselling_notes" (
    "id" TEXT NOT NULL,
    "advisor_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "session_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counselling_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "source" "LMSSource" NOT NULL DEFAULT 'CSV_IMPORT',
    "import_batch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lms_activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "LMSSource" NOT NULL,
    "activity_type" TEXT NOT NULL,
    "duration_mins" INTEGER,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "lms_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendance_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "marks_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "study_activity_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "lms_activity_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "recall_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "behavioural_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "ai_explanation" TEXT,
    "ai_interventions" JSONB,

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_flags" (
    "id" TEXT NOT NULL,
    "risk_score_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "RiskFlagType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "detail" TEXT NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "educator_id" TEXT NOT NULL,
    "risk_score_id" TEXT NOT NULL,
    "ai_plan" TEXT,
    "final_plan" TEXT,
    "educator_note" TEXT,
    "status" "InterventionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "seen_at" TIMESTAMP(3),

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_outcomes" (
    "id" TEXT NOT NULL,
    "intervention_id" TEXT NOT NULL,
    "follow_up_score" DOUBLE PRECISION,
    "delta_score" DOUBLE PRECISION,
    "student_feedback" TEXT,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "result" TEXT,
    "participated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_threshold_configs" (
    "id" TEXT NOT NULL,
    "department_id" TEXT,
    "attendance_min" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "marks_min" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "neglect_days" INTEGER NOT NULL DEFAULT 14,
    "lms_logins_min" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "risk_threshold_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lms_integrations" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "source" "LMSSource" NOT NULL,
    "config" JSONB NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lms_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_snapshots" (
    "id" TEXT NOT NULL,
    "total_users" INTEGER NOT NULL,
    "active_today" INTEGER NOT NULL,
    "red_risk_count" INTEGER NOT NULL,
    "pending_interventions" INTEGER NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "parent_student_links_parent_id_student_id_key" ON "parent_student_links"("parent_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "advisor_assignments_advisor_id_student_id_key" ON "advisor_assignments"("advisor_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_user_id_subject_id_date_key" ON "attendance_records"("user_id", "subject_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "intervention_outcomes_intervention_id_key" ON "intervention_outcomes"("intervention_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_threshold_configs_department_id_key" ON "risk_threshold_configs"("department_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hod_id_fkey" FOREIGN KEY ("hod_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_assignments" ADD CONSTRAINT "advisor_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_advisor_id_fkey" FOREIGN KEY ("advisor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lms_activity_logs" ADD CONSTRAINT "lms_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_risk_score_id_fkey" FOREIGN KEY ("risk_score_id") REFERENCES "risk_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_educator_id_fkey" FOREIGN KEY ("educator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_outcomes" ADD CONSTRAINT "intervention_outcomes_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_threshold_configs" ADD CONSTRAINT "risk_threshold_configs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
