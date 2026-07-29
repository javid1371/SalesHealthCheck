-- CreateTable
CREATE TABLE "automation_heartbeats" (
    "key" TEXT NOT NULL,
    "last_success_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_heartbeats_pkey" PRIMARY KEY ("key")
);
