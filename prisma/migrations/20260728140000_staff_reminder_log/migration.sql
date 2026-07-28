-- CreateEnum
CREATE TYPE "StaffReminderType" AS ENUM ('follow_up_digest');

-- CreateTable
CREATE TABLE "staff_reminder_logs" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "StaffReminderType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_reminder_logs_staff_user_id_date_type_key" ON "staff_reminder_logs"("staff_user_id", "date", "type");

-- CreateIndex
CREATE INDEX "staff_reminder_logs_date_type_idx" ON "staff_reminder_logs"("date", "type");

-- AddForeignKey
ALTER TABLE "staff_reminder_logs" ADD CONSTRAINT "staff_reminder_logs_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
