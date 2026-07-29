import { env } from "@/lib/env";

export function assertCronAuth(request: Request): void {
  const secret = env.smsFunnelCronSecret;
  if (!secret) {
    throw new Error("SMS_FUNNEL_CRON_SECRET is not configured");
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw new Error("Unauthorized");
  }
}
