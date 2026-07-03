-- CreateTable
CREATE TABLE "sms_funnel_step_configs" (
    "id" TEXT NOT NULL,
    "sequence_key" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "body" TEXT,
    "body_low" TEXT,
    "body_medium" TEXT,
    "body_high" TEXT,
    "delay_ms" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_funnel_step_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_funnel_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_funnel_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_funnel_step_configs_sequence_key_step_key_key" ON "sms_funnel_step_configs"("sequence_key", "step_key");
