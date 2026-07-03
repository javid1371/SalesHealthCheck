-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('pending', 'sent', 'failed', 'canceled', 'skipped');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'stopped', 'converted');

-- CreateEnum
CREATE TYPE "ScoreBand" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FunnelEventType" AS ENUM ('report_viewed', 'link_clicked', 'cta_clicked', 'consultation_started', 'sms_sent', 'opt_out');

-- CreateEnum
CREATE TYPE "ShortLinkPurpose" AS ENUM ('start', 'continue_assessment', 'result', 'consultation');

-- CreateTable
CREATE TABLE "funnel_enrollments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assessment_session_id" TEXT,
    "sequence_key" TEXT NOT NULL,
    "current_step" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "score_band" "ScoreBand",
    "messages_sent_count" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'pending',
    "sequence_key" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "assessment_session_id" TEXT,
    "type" "FunnelEventType" NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_links" (
    "slug" VARCHAR(16) NOT NULL,
    "target_url" TEXT NOT NULL,
    "user_id" TEXT,
    "assessment_session_id" TEXT,
    "purpose" "ShortLinkPurpose" NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_links_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "sms_opt_outs" (
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_opt_outs_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "funnel_enrollments_status_idx" ON "funnel_enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_enrollments_user_id_sequence_key_assessment_session_id_key" ON "funnel_enrollments"("user_id", "sequence_key", "assessment_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "sms_messages_dedupe_key_key" ON "sms_messages"("dedupe_key");

-- CreateIndex
CREATE INDEX "sms_messages_status_scheduled_for_idx" ON "sms_messages"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "sms_messages_phone_idx" ON "sms_messages"("phone");

-- CreateIndex
CREATE INDEX "funnel_events_user_id_idx" ON "funnel_events"("user_id");

-- CreateIndex
CREATE INDEX "funnel_events_assessment_session_id_idx" ON "funnel_events"("assessment_session_id");

-- CreateIndex
CREATE INDEX "funnel_events_type_occurred_at_idx" ON "funnel_events"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "short_links_assessment_session_id_idx" ON "short_links"("assessment_session_id");

-- AddForeignKey
ALTER TABLE "funnel_enrollments" ADD CONSTRAINT "funnel_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_enrollments" ADD CONSTRAINT "funnel_enrollments_assessment_session_id_fkey" FOREIGN KEY ("assessment_session_id") REFERENCES "assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "funnel_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_assessment_session_id_fkey" FOREIGN KEY ("assessment_session_id") REFERENCES "assessment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_assessment_session_id_fkey" FOREIGN KEY ("assessment_session_id") REFERENCES "assessment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
