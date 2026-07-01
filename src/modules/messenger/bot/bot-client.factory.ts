import type { MessengerPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import type { BotClient } from "./bot-client.types";
import { createDevBotClient } from "./dev.client";
import { createBaleClient, createTelegramClient } from "./telegram-api.client";

export function createBotClient(platform: MessengerPlatform): BotClient {
  if (platform === "telegram") {
    const token = env.telegramBotToken;
    if (token) {
      return createTelegramClient(token);
    }
    return createDevBotClient("telegram");
  }

  const token = env.baleBotToken;
  if (token) {
    return createBaleClient(token);
  }
  return createDevBotClient("bale");
}
