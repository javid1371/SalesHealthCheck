import { db } from "@/lib/db";
import { pingRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { getFinishQueueDepth } from "@/modules/assessment/finish-queue.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const redis = env.redisUrl ? await pingRedis() : null;

    let finishQueueDepth: number | undefined;
    if (env.redisUrl && env.asyncFinishEnabled && redis) {
      try {
        const depth = await getFinishQueueDepth();
        if (depth !== null) {
          finishQueueDepth = depth;
        }
      } catch {
        // Queue depth is best-effort; do not fail health for BullMQ errors.
      }
    }

    return Response.json({
      status: "ok",
      db: "ok",
      ...(env.redisUrl ? { redis: redis ? "ok" : "unreachable" } : {}),
      ...(finishQueueDepth !== undefined ? { finishQueueDepth } : {}),
    });
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
