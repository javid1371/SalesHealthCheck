import type { BotClient } from "./bot-client.types";

export const MESSENGER_MESSAGE_MAX_LENGTH = 4000;

export async function sendLongText(
  client: BotClient,
  chatId: string,
  parts: string[],
): Promise<void> {
  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }

    await client.sendMessage({
      chatId,
      text: part,
    });
  }
}

export function splitTextForMessenger(
  text: string,
  maxLength = MESSENGER_MESSAGE_MAX_LENGTH,
): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const parts: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n\n", maxLength);
    if (splitAt < maxLength / 2) {
      splitAt = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitAt < maxLength / 2) {
      splitAt = maxLength;
    }

    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}
