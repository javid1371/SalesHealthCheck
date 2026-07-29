-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN "assignment_paused_at" TIMESTAMP(3);
ALTER TABLE "staff_users" ADD COLUMN "assignment_paused_reason" TEXT;
ALTER TABLE "staff_users" ADD COLUMN "max_daily_calls" INTEGER;
