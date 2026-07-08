-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FunnelEventType" ADD VALUE 'landing_view';
ALTER TYPE "FunnelEventType" ADD VALUE 'assessment_start_click';
ALTER TYPE "FunnelEventType" ADD VALUE 'otp_sent';
ALTER TYPE "FunnelEventType" ADD VALUE 'phone_verified';
ALTER TYPE "FunnelEventType" ADD VALUE 'assessment_started';
ALTER TYPE "FunnelEventType" ADD VALUE 'domain_completed';
ALTER TYPE "FunnelEventType" ADD VALUE 'review_reached';
ALTER TYPE "FunnelEventType" ADD VALUE 'assessment_completed';
ALTER TYPE "FunnelEventType" ADD VALUE 'consultation_submitted';
