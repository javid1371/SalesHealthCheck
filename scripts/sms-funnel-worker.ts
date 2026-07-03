import { Worker } from "bullmq";
import { getBullMqConnection } from "@/lib/redis";
import { env } from "@/lib/env";
import { processSmsFunnelJob } from "@/modules/sms-funnel/sms-funnel.processor";
import {
  SMS_FUNNEL_QUEUE_NAME,
  type SmsFunnelJobPayload,
} from "@/modules/sms-funnel/sms-funnel.types";

async function main() {
  if (!env.smsFunnelEnabled) {
    console.error("SMS_FUNNEL_ENABLED is not true — worker exiting.");
    process.exit(1);
  }

  const connection = getBullMqConnection();
  if (!connection) {
    console.error("REDIS_URL is required for sms-funnel worker.");
    process.exit(1);
  }

  const worker = new Worker<SmsFunnelJobPayload>(
    SMS_FUNNEL_QUEUE_NAME,
    async (job) => {
      await processSmsFunnelJob(job.data);
    },
    {
      connection,
      concurrency: Number(process.env.SMS_FUNNEL_WORKER_CONCURRENCY ?? 5),
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`[sms-funnel] job ${job?.id} failed:`, error);
  });

  console.log("[sms-funnel] worker started");

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
