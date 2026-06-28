-- AlterTable
ALTER TABLE "model_versions" ADD COLUMN "diagnosis_engine_version" TEXT NOT NULL DEFAULT 'v1';

-- AlterTable
ALTER TABLE "assessment_sessions" ADD COLUMN "structured_diagnosis" JSONB;
