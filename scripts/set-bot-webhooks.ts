/**
 * One-time setup: register Telegram and Bale webhook URLs with the bot APIs.
 *
 * Usage:
 *   APP_BASE_URL=https://your-domain.example tsx scripts/set-bot-webhooks.ts
 *
 * Requires TELEGRAM_BOT_TOKEN / BALE_BOT_TOKEN and matching webhook secrets in env.
 */
import { env } from "../src/lib/env";

type SetWebhookResponse = {
  ok: boolean;
  description?: string;
};

async function setWebhook(params: {
  platform: string;
  baseUrl: string;
  webhookUrl: string;
  secret?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    url: params.webhookUrl,
    allowed_updates: ["message", "callback_query"],
  };

  if (params.secret) {
    body.secret_token = params.secret;
  }

  const response = await fetch(`${params.baseUrl}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as SetWebhookResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(
      `${params.platform} setWebhook failed: ${payload.description ?? response.statusText}`,
    );
  }

  console.log(`${params.platform} webhook registered: ${params.webhookUrl}`);
}

async function main() {
  const appBaseUrl = env.appBaseUrl.replace(/\/$/, "");

  if (env.telegramBotToken) {
    await setWebhook({
      platform: "telegram",
      baseUrl: `https://api.telegram.org/bot${env.telegramBotToken}`,
      webhookUrl: `${appBaseUrl}/api/webhooks/telegram`,
      secret: env.telegramWebhookSecret,
    });
  } else {
    console.warn("TELEGRAM_BOT_TOKEN not set — skipping Telegram webhook.");
  }

  if (env.baleBotToken) {
    const secretQuery = env.baleWebhookSecret
      ? `?secret=${encodeURIComponent(env.baleWebhookSecret)}`
      : "";

    await setWebhook({
      platform: "bale",
      baseUrl: `https://tapi.bale.ai/bot${env.baleBotToken}`,
      webhookUrl: `${appBaseUrl}/api/webhooks/bale${secretQuery}`,
      secret: env.baleWebhookSecret,
    });
  } else {
    console.warn("BALE_BOT_TOKEN not set — skipping Bale webhook.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
