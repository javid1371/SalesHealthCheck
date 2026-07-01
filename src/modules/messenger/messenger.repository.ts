import type {
  BotConversationState,
  MessengerPlatform,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { BotConversationRecord } from "./messenger.types";

export async function findOrCreateConversation(
  platform: MessengerPlatform,
  chatId: string,
): Promise<BotConversationRecord> {
  const existing = await db.botConversation.findUnique({
    where: {
      platform_chatId: {
        platform,
        chatId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return db.botConversation.create({
    data: {
      platform,
      chatId,
      state: "idle",
    },
  });
}

export async function updateConversation(
  id: string,
  data: Partial<{
    userId: string | null;
    assessmentId: string | null;
    state: BotConversationState;
    currentDomainIndex: number;
    currentQuestionIndex: number;
    lastPromptMessageId: string | null;
    contactFirstName: string | null;
    businessName: string | null;
    teamSize: string | null;
  }>,
): Promise<BotConversationRecord> {
  return db.botConversation.update({
    where: { id },
    data,
  });
}

export async function resetConversation(
  conversation: BotConversationRecord,
): Promise<BotConversationRecord> {
  return updateConversation(conversation.id, {
    userId: null,
    assessmentId: null,
    state: "idle",
    currentDomainIndex: 0,
    currentQuestionIndex: 0,
    lastPromptMessageId: null,
    contactFirstName: null,
    businessName: null,
    teamSize: null,
  });
}
