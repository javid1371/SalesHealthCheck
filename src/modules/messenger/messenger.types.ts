import type {
  BotConversationState,
  MessengerPlatform,
} from "@prisma/client";

export type { BotConversationState, MessengerPlatform };

export type MessengerUpdate =
  | {
      type: "command";
      chatId: string;
      command: string;
      firstName?: string;
    }
  | {
      type: "text";
      chatId: string;
      text: string;
      firstName?: string;
    }
  | {
      type: "contact";
      chatId: string;
      phone: string;
      firstName?: string;
    }
  | {
      type: "callback";
      chatId: string;
      callbackQueryId: string;
      data: string;
      messageId?: string;
    };

export type BotConversationRecord = {
  id: string;
  platform: MessengerPlatform;
  chatId: string;
  userId: string | null;
  assessmentId: string | null;
  state: BotConversationState;
  currentDomainIndex: number;
  currentQuestionIndex: number;
  lastPromptMessageId: string | null;
  contactFirstName: string | null;
  businessName: string | null;
  teamSize: string | null;
};

export const TEAM_SIZE_CALLBACK_PREFIX = "team:";
export const SALES_MODEL_CALLBACK_PREFIX = "model:";
