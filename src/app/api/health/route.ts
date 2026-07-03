import { db } from "@/lib/db";
import { pingRedis } from "@/lib/redis";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const redis = env.redisUrl ? await pingRedis() : null;

    return Response.json({
      status: "ok",
      db: "ok",
      ...(env.redisUrl ? { redis: redis ? "ok" : "unreachable" } : {}),
    });
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
