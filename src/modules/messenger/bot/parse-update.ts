import type { MessengerUpdate } from "../messenger.types";

type TelegramUser = {
  first_name?: string;
};

type TelegramChat = {
  id: number | string;
};

type TelegramContact = {
  phone_number: string;
  first_name?: string;
};

type TelegramMessage = {
  message_id?: number;
  chat: TelegramChat;
  text?: string;
  contact?: TelegramContact;
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: TelegramMessage;
  from?: TelegramUser;
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

function chatIdFromChat(chat: TelegramChat): string {
  return String(chat.id);
}

export function parseMessengerUpdate(body: unknown): MessengerUpdate | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const update = body as TelegramUpdate;

  if (update.callback_query) {
    const callback = update.callback_query;
    const chatId = callback.message
      ? chatIdFromChat(callback.message.chat)
      : undefined;

    if (!chatId || !callback.data) {
      return null;
    }

    return {
      type: "callback",
      chatId,
      callbackQueryId: callback.id,
      data: callback.data,
      messageId:
        callback.message?.message_id !== undefined
          ? String(callback.message.message_id)
          : undefined,
    };
  }

  const message = update.message;
  if (!message) {
    return null;
  }

  const chatId = chatIdFromChat(message.chat);
  const firstName = message.from?.first_name ?? message.contact?.first_name;

  if (message.contact?.phone_number) {
    return {
      type: "contact",
      chatId,
      phone: message.contact.phone_number,
      firstName,
    };
  }

  const text = message.text?.trim();
  if (!text) {
    return null;
  }

  if (text.startsWith("/")) {
    const command = text.split(/\s+/)[0]?.slice(1).toLowerCase() ?? "";
    return {
      type: "command",
      chatId,
      command,
      firstName,
    };
  }

  return {
    type: "text",
    chatId,
    text,
    firstName,
  };
}
