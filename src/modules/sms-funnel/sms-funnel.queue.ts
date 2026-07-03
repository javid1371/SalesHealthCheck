import { Queue } from "bullmq";
import { getBullMqConnection } from "@/lib/redis";
import { env } from "@/lib/env";
import type { SmsFunnelJobPayload } from "./sms-funnel.types";
import { SMS_FUNNEL_QUEUE_NAME, toBullMqJobId } from "./sms-funnel.types";

let queue: Queue<SmsFunnelJobPayload> | null = null;

export function getSmsFunnelQueue(): Queue<SmsFunnelJobPayload> | null {
  if (!env.smsFunnelEnabled) return null;

  const connection = getBullMqConnection();
  if (!connection) return null;

  if (!queue) {
    queue = new Queue<SmsFunnelJobPayload>(SMS_FUNNEL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    });
  }

  return queue;
}

export async function enqueueSmsFunnelJob(
  payload: SmsFunnelJobPayload,
  delayMs: number,
): Promise<void> {
  const q = getSmsFunnelQueue();
  if (!q) {
    console.warn(
      `[sms-funnel] Redis unavailable — job ${payload.dedupeKey} not enqueued`,
    );
    return;
  }

  await q.add("send", payload, {
    jobId: toBullMqJobId(payload.dedupeKey),
    delay: Math.max(0, delayMs),
  });
}

export async function closeSmsFunnelQueueForTests(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
