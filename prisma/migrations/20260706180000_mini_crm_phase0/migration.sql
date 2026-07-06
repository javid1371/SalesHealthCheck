-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'messenger';

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM (
    'created',
    'status_change',
    'assignment_change',
    'note_added',
    'probability_override',
    'follow_up_set'
);

-- AlterTable
ALTER TABLE "consultation_requests"
ADD COLUMN "first_contacted_at" TIMESTAMP(3),
ADD COLUMN "closed_at" TIMESTAMP(3),
ADD COLUMN "admin_probability_override_percent" INTEGER;

-- CreateTable
CREATE TABLE "lead_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "consultation_request_id" TEXT NOT NULL,
    "staff_user_id" TEXT,
    "type" "LeadActivityType" NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_activities_consultation_request_id_idx" ON "lead_activities"("consultation_request_id");

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_consultation_request_id_fkey" FOREIGN KEY ("consultation_request_id") REFERENCES "consultation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
