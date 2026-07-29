import { Queue } from "bullmq";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { getBullMqConnection } from "@/lib/redis";
import {
  FINISH_QUEUE_NAME,
  toFinishJobId,
  type FinishJobPayload,
  type FinishJobStatus,
} from "./finish-queue.types";

let queue: Queue<FinishJobPayload> | null = null;

export function getFinishQueue(): Queue<FinishJobPayload> | null {
  if (!env.asyncFinishEnabled) return null;

  const connection = getBullMqConnection();
  if (!connection) return null;

  if (!queue) {
    queue = new Queue<FinishJobPayload>(FINISH_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 2,
        backoff: { type: "exponential", delay: 5_000 },
      },
    });
  }

  return queue;
}

export async function enqueueFinishJob(
  payload: FinishJobPayload,
): Promise<string> {
  const q = getFinishQueue();
  if (!q) {
    throw new AppError(
      "finish_queue_unavailable",
      "Finish queue is unavailable. Ensure Redis is configured.",
      503,
    );
  }

  const jobId = toFinishJobId(payload.assessmentId);
  const existing = await q.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    } else {
      return String(existing.id ?? jobId);
    }
  }

  const job = await q.add("finish", payload, { jobId });
  return String(job.id ?? jobId);
}

export async function getFinishJobState(
  assessmentId: string,
): Promise<{ status: FinishJobStatus; error?: string } | null> {
  const q = getFinishQueue();
  if (!q) return null;

  const job = await q.getJob(toFinishJobId(assessmentId));
  if (!job) return null;

  const state = await job.getState();
  switch (state) {
    case "waiting":
    case "delayed":
    case "waiting-children":
    case "prioritized":
      return { status: "queued" };
    case "active":
      return { status: "active" };
    case "completed":
      return { status: "completed" };
    case "failed":
      return {
        status: "failed",
        error: job.failedReason || "Finish job failed",
      };
    default:
      return { status: "queued" };
  }
}

/**
 * Waiting + active + delayed + prioritized finish jobs (ops / health).
 * Returns null when the queue is unavailable (async off or no Redis).
 */
export async function getFinishQueueDepth(): Promise<number | null> {
  const q = getFinishQueue();
  if (!q) return null;

  const counts = await q.getJobCounts(
    "waiting",
    "active",
    "delayed",
    "prioritized",
    "paused",
  );

  return (
    (counts.waiting ?? 0) +
    (counts.active ?? 0) +
    (counts.delayed ?? 0) +
    (counts.prioritized ?? 0) +
    (counts.paused ?? 0)
  );
}

export async function closeFinishQueueForTests(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
