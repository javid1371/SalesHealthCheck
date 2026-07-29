/**
 * Assessment finish BullMQ worker entrypoint (ADR 0017).
 * Mirrors sms-funnel-worker: same image, different CMD.
 */
import * as Sentry from "@sentry/nextjs";
import { Worker } from "bullmq";
import { getBullMqConnection } from "@/lib/redis";
import { env } from "@/lib/env";
import { runFinishAssessmentCore } from "@/modules/assessment/assessment.service";
import {
  FINISH_QUEUE_NAME,
  type FinishJobPayload,
} from "@/modules/assessment/finish-queue.types";

async function main() {
  if (!env.asyncFinishEnabled) {
    console.log("[finish] ASYNC_FINISH_ENABLED is false — worker idle.");
    setInterval(() => {}, 60_000);
    return;
  }

  const connection = getBullMqConnection();
  if (!connection) {
    console.error("REDIS_URL is required for finish worker.");
    process.exit(1);
  }

  const worker = new Worker<FinishJobPayload>(
    FINISH_QUEUE_NAME,
    async (job) => {
      await runFinishAssessmentCore(job.data.assessmentId);
    },
    {
      connection,
      concurrency: env.finishWorkerConcurrency,
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`[finish] job ${job?.id} failed:`, error);
    Sentry.captureException(error, {
      tags: { queue: FINISH_QUEUE_NAME },
      extra: { jobId: job?.id, assessmentId: job?.data?.assessmentId },
    });
  });

  console.log(
    `[finish] worker started (concurrency=${env.finishWorkerConcurrency})`,
  );

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main().catch((error) => {
  console.error("[finish] worker failed:", error);
  process.exit(1);
});
