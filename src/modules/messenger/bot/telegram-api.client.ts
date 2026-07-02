import type { BotClient, ReplyMarkup } from "./bot-client.types";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramMessage = {
  message_id: number;
};

function buildReplyMarkup(markup?: ReplyMarkup): Record<string, unknown> | undefined {
  if (!markup) return undefined;

  if (markup.type === "remove") {
    return { remove_keyboard: true };
  }

  if (markup.type === "inline") {
    return {
      inline_keyboard: markup.rows.map((row) =>
        row.map((button) => ({
          text: button.text,
          callback_data: button.callbackData,
        })),
      ),
    };
  }

  return {
    keyboard: markup.rows.map((row) =>
      row.map((button) => ({
        text: button.text,
        request_contact: button.requestContact ?? false,
      })),
    ),
    one_time_keyboard: markup.oneTimeKeyboard ?? true,
    resize_keyboard: true,
  };
}

function createTelegramCompatibleClient(
  platform: string,
  baseUrl: string,
): BotClient {
  async function callApi<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as TelegramApiResponse<T>;

    if (!response.ok || !payload.ok) {
      throw new Error(
        `${platform} API ${method} failed: ${payload.description ?? response.statusText}`,
      );
    }

    if (payload.result === undefined) {
      throw new Error(`${platform} API ${method} returned no result`);
    }

    return payload.result;
  }

  async function callApiMultipart<T>(
    method: string,
    fields: Record<string, string>,
    fileField: string,
    file: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<T> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    formData.append(
      fileField,
      new Blob([file], { type: mimeType }),
      filename,
    );

    const response = await fetch(`${baseUrl}/${method}`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as TelegramApiResponse<T>;

    if (!response.ok || !payload.ok) {
      throw new Error(
        `${platform} API ${method} failed: ${payload.description ?? response.statusText}`,
      );
    }

    if (payload.result === undefined) {
      throw new Error(`${platform} API ${method} returned no result`);
    }

    return payload.result;
  }

  return {
    async sendMessage({ chatId, text, replyMarkup }) {
      const result = await callApi<TelegramMessage>("sendMessage", {
        chat_id: chatId,
        text,
        reply_markup: buildReplyMarkup(replyMarkup),
      });

      return { messageId: String(result.message_id) };
    },

    async answerCallbackQuery({ callbackQueryId, text }) {
      await callApi<boolean>("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      });
    },

    async editMessageReplyMarkup({ chatId, messageId }) {
      await callApi<TelegramMessage>("editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: Number(messageId),
        reply_markup: { inline_keyboard: [] },
      });
    },

    async sendPhoto({ chatId, photo, filename = "chart.png", caption, replyMarkup }) {
      const fields: Record<string, string> = { chat_id: chatId };
      if (caption) {
        fields.caption = caption;
      }
      const markup = buildReplyMarkup(replyMarkup);
      if (markup) {
        fields.reply_markup = JSON.stringify(markup);
      }

      const result = await callApiMultipart<TelegramMessage>(
        "sendPhoto",
        fields,
        "photo",
        photo,
        filename,
        "image/png",
      );

      return { messageId: String(result.message_id) };
    },

    async sendDocument({
      chatId,
      document,
      filename,
      caption,
      replyMarkup,
    }) {
      const fields: Record<string, string> = { chat_id: chatId };
      if (caption) {
        fields.caption = caption;
      }
      const markup = buildReplyMarkup(replyMarkup);
      if (markup) {
        fields.reply_markup = JSON.stringify(markup);
      }

      const result = await callApiMultipart<TelegramMessage>(
        "sendDocument",
        fields,
        "document",
        document,
        filename,
        "application/pdf",
      );

      return { messageId: String(result.message_id) };
    },
  };
}

export function createTelegramClient(token: string): BotClient {
  return createTelegramCompatibleClient(
    "telegram",
    `https://api.telegram.org/bot${token}`,
  );
}

export function createBaleClient(token: string): BotClient {
  return createTelegramCompatibleClient(
    "bale",
    `https://tapi.bale.ai/bot${token}`,
  );
}
