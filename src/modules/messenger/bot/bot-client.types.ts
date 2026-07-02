export type InlineButton = {
  text: string;
  callbackData: string;
};

export type ReplyKeyboardButton = {
  text: string;
  requestContact?: boolean;
};

export type ReplyMarkup =
  | {
      type: "inline";
      rows: InlineButton[][];
    }
  | {
      type: "reply";
      rows: ReplyKeyboardButton[][];
      oneTimeKeyboard?: boolean;
    }
  | {
      type: "remove";
    };

export interface BotClient {
  sendMessage(params: {
    chatId: string;
    text: string;
    replyMarkup?: ReplyMarkup;
  }): Promise<{ messageId: string }>;

  answerCallbackQuery(params: {
    callbackQueryId: string;
    text?: string;
  }): Promise<void>;

  editMessageReplyMarkup(params: {
    chatId: string;
    messageId: string;
  }): Promise<void>;

  sendPhoto(params: {
    chatId: string;
    photo: Buffer;
    filename?: string;
    caption?: string;
    replyMarkup?: ReplyMarkup;
  }): Promise<{ messageId: string }>;

  sendDocument(params: {
    chatId: string;
    document: Buffer;
    filename: string;
    caption?: string;
    replyMarkup?: ReplyMarkup;
  }): Promise<{ messageId: string }>;
}
