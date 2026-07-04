-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "assign_scheduled_for" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "consultation_requests_assign_scheduled_for_assigned_to_id_source_idx" ON "consultation_requests"("assign_scheduled_for", "assigned_to_id", "source");
