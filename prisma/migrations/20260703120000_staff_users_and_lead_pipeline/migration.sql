-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('admin', 'sales_expert');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'meeting_scheduled', 'closed_won', 'closed_lost', 'unreachable');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_notes" (
    "id" TEXT NOT NULL,
    "consultation_request_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_notes_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'new',
ADD COLUMN "assigned_to_id" TEXT,
ADD COLUMN "next_follow_up_at" TIMESTAMP(3),
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_phone_key" ON "staff_users"("phone");

-- CreateIndex
CREATE INDEX "consultation_notes_consultation_request_id_idx" ON "consultation_notes"("consultation_request_id");

-- CreateIndex
CREATE INDEX "consultation_requests_assigned_to_id_idx" ON "consultation_requests"("assigned_to_id");

-- CreateIndex
CREATE INDEX "consultation_requests_status_idx" ON "consultation_requests"("status");

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_consultation_request_id_fkey" FOREIGN KEY ("consultation_request_id") REFERENCES "consultation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_notes" ADD CONSTRAINT "consultation_notes_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
