-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('direct', 'system');

-- CreateEnum
CREATE TYPE "PurchaseProbability" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "source" "LeadSource" NOT NULL DEFAULT 'direct';
ALTER TABLE "consultation_requests" ADD COLUMN "purchase_probability_percent" INTEGER;
ALTER TABLE "consultation_requests" ADD COLUMN "purchase_probability_band" "PurchaseProbability";

-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN "last_assigned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "consultation_requests_source_idx" ON "consultation_requests"("source");
