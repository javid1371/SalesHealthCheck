-- CreateTable
CREATE TABLE "consultation_requests" (
    "id" TEXT NOT NULL,
    "assessment_session_id" TEXT,
    "report_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_requests_assessment_session_id_idx" ON "consultation_requests"("assessment_session_id");

-- CreateIndex
CREATE INDEX "consultation_requests_created_at_idx" ON "consultation_requests"("created_at");

-- CreateIndex
CREATE INDEX "assessment_sessions_status_idx" ON "assessment_sessions"("status");

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_assessment_session_id_fkey" FOREIGN KEY ("assessment_session_id") REFERENCES "assessment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
