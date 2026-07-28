-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM (
    'no_answer',
    'busy',
    'connected_interested',
    'connected_not_interested',
    'wrong_number',
    'callback_requested'
);

-- AlterEnum
ALTER TYPE "LeadActivityType" ADD VALUE 'call_logged';

-- AlterTable
ALTER TABLE "consultation_requests"
ADD COLUMN "last_call_outcome" "CallOutcome",
ADD COLUMN "last_called_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lead_call_logs" (
    "id" TEXT NOT NULL,
    "consultation_request_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_call_logs_consultation_request_id_idx" ON "lead_call_logs"("consultation_request_id");

-- CreateIndex
CREATE INDEX "lead_call_logs_staff_user_id_created_at_idx" ON "lead_call_logs"("staff_user_id", "created_at");

-- CreateIndex
CREATE INDEX "consultation_requests_last_call_outcome_idx" ON "consultation_requests"("last_call_outcome");

-- CreateIndex
CREATE INDEX "consultation_requests_last_called_at_idx" ON "consultation_requests"("last_called_at");

-- AddForeignKey
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_consultation_request_id_fkey" FOREIGN KEY ("consultation_request_id") REFERENCES "consultation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
