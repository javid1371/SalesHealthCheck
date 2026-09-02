-- CreateEnum
CREATE TYPE "SmsInboundHandledAs" AS ENUM ('interest', 'opt_out', 'ignored');

-- CreateTable
CREATE TABLE "sms_inbounds" (
    "id" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "from_phone" TEXT NOT NULL,
    "to_line" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "handled_as" "SmsInboundHandledAs" NOT NULL,
    "consultation_request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_inbounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_inbounds_provider_message_id_key" ON "sms_inbounds"("provider_message_id");

-- CreateIndex
CREATE INDEX "sms_inbounds_from_phone_idx" ON "sms_inbounds"("from_phone");

-- CreateIndex
CREATE INDEX "sms_inbounds_consultation_request_id_idx" ON "sms_inbounds"("consultation_request_id");

-- AddForeignKey
ALTER TABLE "sms_inbounds" ADD CONSTRAINT "sms_inbounds_consultation_request_id_fkey" FOREIGN KEY ("consultation_request_id") REFERENCES "consultation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
