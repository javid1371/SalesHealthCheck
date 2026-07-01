import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createBotClient } from "@/modules/messenger/bot/bot-client.factory";
import { parseMessengerUpdate } from "@/modules/messenger/bot/parse-update";
import { handleMessengerUpdate } from "@/modules/messenger/messenger.service";

function assertTelegramWebhookSecret(request: NextRequest): void {
  const secret = env.telegramWebhookSecret;
  if (!secret) {
    return;
  }

  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (header !== secret) {
    throw new Error("invalid_webhook_secret");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTelegramWebhookSecret(request);

    const body = await request.json();
    const update = parseMessengerUpdate(body);

    if (update) {
      const client = createBotClient("telegram");
      await handleMessengerUpdate(update, client, "telegram");
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return new Response("OK", { status: 200 });
}
