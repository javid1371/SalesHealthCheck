-- AlterTable
ALTER TABLE "consultation_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "sales_funnels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "assessment_session_id" TEXT,
    "name" TEXT NOT NULL,
    "sales_model" "SalesModel",
    "average_order_value" DOUBLE PRECISION,
    "repeat_purchase_rate" DOUBLE PRECISION,
    "share_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_funnel_stages" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "count" DOUBLE PRECISION NOT NULL,
    "domain_id" TEXT,

    CONSTRAINT "sales_funnel_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_funnel_snapshots" (
    "id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "sales_funnel_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_funnels_share_token_key" ON "sales_funnels"("share_token");

-- CreateIndex
CREATE INDEX "sales_funnels_user_id_idx" ON "sales_funnels"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_funnel_stages_funnel_id_stage_order_key" ON "sales_funnel_stages"("funnel_id", "stage_order");

-- CreateIndex
CREATE INDEX "sales_funnel_snapshots_funnel_id_idx" ON "sales_funnel_snapshots"("funnel_id");

-- AddForeignKey
ALTER TABLE "sales_funnels" ADD CONSTRAINT "sales_funnels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_funnels" ADD CONSTRAINT "sales_funnels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_funnels" ADD CONSTRAINT "sales_funnels_assessment_session_id_fkey" FOREIGN KEY ("assessment_session_id") REFERENCES "assessment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_funnel_stages" ADD CONSTRAINT "sales_funnel_stages_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "sales_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_funnel_stages" ADD CONSTRAINT "sales_funnel_stages_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_funnel_snapshots" ADD CONSTRAINT "sales_funnel_snapshots_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "sales_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "consultation_requests_assign_scheduled_for_assigned_to_id_sourc" RENAME TO "consultation_requests_assign_scheduled_for_assigned_to_id_s_idx";

-- RenameIndex
ALTER INDEX "funnel_enrollments_user_id_sequence_key_assessment_session_id_k" RENAME TO "funnel_enrollments_user_id_sequence_key_assessment_session__key";
