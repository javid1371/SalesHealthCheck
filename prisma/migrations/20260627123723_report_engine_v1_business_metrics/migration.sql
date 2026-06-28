-- AlterTable
ALTER TABLE "assessment_sessions" ADD COLUMN     "average_order_value" DOUBLE PRECISION,
ADD COLUMN     "monthly_leads" DOUBLE PRECISION,
ADD COLUMN     "monthly_revenue" DOUBLE PRECISION,
ADD COLUMN     "repeat_purchase_rate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "report_spec" JSONB;
