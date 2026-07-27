-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'assessment_in_progress' BEFORE 'new';
ALTER TYPE "LeadStatus" ADD VALUE 'assessment_incomplete' BEFORE 'new';
ALTER TYPE "LeadStatus" ADD VALUE 'assessment_completed' BEFORE 'new';
