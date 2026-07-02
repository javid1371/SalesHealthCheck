import type { BotClient } from "./bot-client.types";

export function createDevBotClient(platform: string): BotClient {
  return {
    async sendMessage({ chatId, text, replyMarkup }) {
      console.log(
        `[dev:${platform}] sendMessage chat=${chatId} text=${text.slice(0, 80)} markup=${JSON.stringify(replyMarkup ?? null)}`,
      );
      return { messageId: String(Date.now()) };
    },

    async answerCallbackQuery({ callbackQueryId, text }) {
      console.log(
        `[dev:${platform}] answerCallbackQuery id=${callbackQueryId} text=${text ?? ""}`,
      );
    },

    async editMessageReplyMarkup({ chatId, messageId }) {
      console.log(
        `[dev:${platform}] editMessageReplyMarkup chat=${chatId} message=${messageId}`,
      );
    },

    async sendPhoto({ chatId, photo, filename, caption }) {
      console.log(
        `[dev:${platform}] sendPhoto chat=${chatId} bytes=${photo.length} filename=${filename ?? "chart.png"} caption=${caption ?? ""}`,
      );
      return { messageId: String(Date.now()) };
    },

    async sendDocument({ chatId, document, filename, caption }) {
      console.log(
        `[dev:${platform}] sendDocument chat=${chatId} bytes=${document.length} filename=${filename} caption=${caption ?? ""}`,
      );
      return { messageId: String(Date.now()) };
    },
  };
}
