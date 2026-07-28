-- CreateEnum
CREATE TYPE "LostReason" AS ENUM (
    'price',
    'timing',
    'competitor',
    'no_response',
    'low_quality',
    'not_a_fit',
    'other'
);

-- AlterTable
ALTER TABLE "consultation_requests"
ADD COLUMN "lost_reason" "LostReason",
ADD COLUMN "lost_note" TEXT;

-- CreateIndex
CREATE INDEX "consultation_requests_lost_reason_idx" ON "consultation_requests"("lost_reason");
