import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createBotClient } from "@/modules/messenger/bot/bot-client.factory";
import { parseMessengerUpdate } from "@/modules/messenger/bot/parse-update";
import { handleMessengerUpdate } from "@/modules/messenger/messenger.service";

function assertBaleWebhookSecret(request: NextRequest): void {
  const secret = env.baleWebhookSecret;
  if (!secret) {
    return;
  }

  const header = request.headers.get("x-telegram-bot-api-secret-token");
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (header !== secret && querySecret !== secret) {
    throw new Error("invalid_webhook_secret");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertBaleWebhookSecret(request);

    const body = await request.json();
    const update = parseMessengerUpdate(body);

    if (update) {
      const client = createBotClient("bale");
      await handleMessengerUpdate(update, client, "bale");
    }
  } catch (error) {
    console.error("Bale webhook error:", error);
  }

  return new Response("OK", { status: 200 });
}
