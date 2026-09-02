import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  handleInboundSms,
  inboundSmsFromKavenegarParams,
} from "@/modules/sms-funnel/inbound.service";

function assertKavenegarInboundSecret(request: NextRequest): void {
  const secret = env.kavenegarInboundWebhookSecret;
  if (!secret) {
    if (env.nodeEnv === "production") {
      throw new Error("kavenegar_inbound_secret_unconfigured");
    }
    return;
  }

  const querySecret = request.nextUrl.searchParams.get("secret");
  if (querySecret !== secret) {
    throw new Error("invalid_webhook_secret");
  }
}

async function collectInboundParams(
  request: NextRequest,
): Promise<URLSearchParams | Record<string, unknown>> {
  const query = request.nextUrl.searchParams;
  if (request.method === "GET") {
    return query;
  }

  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as unknown;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return {
          ...Object.fromEntries(query.entries()),
          ...(body as Record<string, unknown>),
        };
      }
    } else {
      const form = await request.formData();
      const merged = new URLSearchParams(query);
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
          merged.set(key, value);
        }
      }
      return merged;
    }
  } catch {
    // Query params still apply when the body is empty or unreadable.
  }

  return query;
}

async function handleKavenegarInbound(request: NextRequest): Promise<Response> {
  try {
    assertKavenegarInboundSecret(request);
    const params = await collectInboundParams(request);
    await handleInboundSms(inboundSmsFromKavenegarParams(params));
  } catch (error) {
    console.error("Kavenegar inbound webhook error:", error);
  }

  return new Response("OK", { status: 200 });
}

export async function GET(request: NextRequest) {
  return handleKavenegarInbound(request);
}

export async function POST(request: NextRequest) {
  return handleKavenegarInbound(request);
}
