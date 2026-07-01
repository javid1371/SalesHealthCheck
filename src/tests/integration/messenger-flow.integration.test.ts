/**
 * Messenger channel integration — contact auth + menu + assessment lifecycle.
 */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { BotClient } from "@/modules/messenger/bot/bot-client.types";
import { resolveUserFromContactPhone } from "@/modules/messenger/messenger-auth.service";
import { handleMessengerUpdate } from "@/modules/messenger/messenger.service";
import { MAIN_MENU_TEXT } from "@/modules/messenger/messenger-menu";
import {
  getAssessmentQuestions,
} from "@/modules/assessment/assessment.service";

const RUN_ID = Date.now();

function createFakeClient(): BotClient & {
  messages: Array<{ chatId: string; text: string }>;
} {
  const messages: Array<{ chatId: string; text: string }> = [];

  return {
    messages,
    async sendMessage({ chatId, text }) {
      messages.push({ chatId, text });
      return { messageId: String(messages.length) };
    },
    async answerCallbackQuery() {},
    async editMessageReplyMarkup() {},
  };
}

function buildAllAnswers(questions: Awaited<ReturnType<typeof getAssessmentQuestions>>) {
  const answers: { questionId: string; selectedOptionId: string }[] = [];
  for (const domain of questions.domains) {
    for (const question of domain.questions) {
      const option = question.options[1] ?? question.options[0];
      answers.push({ questionId: question.id, selectedOptionId: option.id });
    }
  }
  return answers;
}

describe("messenger flow (integration)", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("resolves user from shared contact phone", async () => {
    const phone = `0914${String(RUN_ID).slice(-7)}`;

    const first = await resolveUserFromContactPhone(phone);
    const second = await resolveUserFromContactPhone(phone);

    expect(first.userId).toBe(second.userId);
    expect(first.normalizedPhone).toBe(phone);

    const user = await db.user.findFirst({ where: { id: first.userId } });
    expect(user?.phoneVerifiedAt).not.toBeNull();
  });

  it("shows main menu after contact and completes assessment with in-chat report", async () => {
    const chatId = `integration-chat-${RUN_ID}`;
    const phone = `0915${String(RUN_ID).slice(-7)}`;
    const client = createFakeClient();

    await handleMessengerUpdate(
      { type: "command", chatId, command: "start", firstName: "Tester" },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      { type: "contact", chatId, phone, firstName: "Tester" },
      client,
      "telegram",
    );

    expect(client.messages.some((message) => message.text.includes(MAIN_MENU_TEXT))).toBe(
      true,
    );

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId,
        callbackQueryId: "cb-menu-new",
        data: "menu:new",
        messageId: "1",
      },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      { type: "text", chatId, text: "Messenger Test Co", firstName: "Tester" },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId,
        callbackQueryId: "cb-team",
        data: "team:1-5",
        messageId: "2",
      },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId,
        callbackQueryId: "cb-model",
        data: "model:online",
        messageId: "3",
      },
      client,
      "telegram",
    );

    const conversation = await db.botConversation.findUnique({
      where: {
        platform_chatId: { platform: "telegram", chatId },
      },
    });

    expect(conversation?.assessmentId).toBeTruthy();
    expect(conversation?.state).toBe("answering_questions");

    const questions = await getAssessmentQuestions(conversation!.assessmentId!);
    const answers = buildAllAnswers(questions);

    for (let index = 0; index < answers.length; index += 1) {
      const answer = answers[index]!;
      await handleMessengerUpdate(
        {
          type: "callback",
          chatId,
          callbackQueryId: `cb-${index}`,
          data: answer.selectedOptionId,
          messageId: String(index + 10),
        },
        client,
        "telegram",
      );
    }

    const updatedConversation = await db.botConversation.findUnique({
      where: {
        platform_chatId: { platform: "telegram", chatId },
      },
    });

    expect(updatedConversation?.state).toBe("at_main_menu");
    expect(
      client.messages.some((message) => message.text.includes("گزارش ارزیابی")),
    ).toBe(true);
    expect(
      client.messages.some((message) => message.text.includes("گزارش کامل:")),
    ).toBe(false);
  });

  it("submits consultation request from menu flow", async () => {
    const chatId = `integration-consult-${RUN_ID}`;
    const phone = `0916${String(RUN_ID).slice(-7)}`;
    const client = createFakeClient();

    await handleMessengerUpdate(
      { type: "command", chatId, command: "start", firstName: "Consult" },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      { type: "contact", chatId, phone, firstName: "Consult" },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId,
        callbackQueryId: "cb-consult",
        data: "menu:consult",
        messageId: "20",
      },
      client,
      "telegram",
    );

    await handleMessengerUpdate(
      {
        type: "text",
        chatId,
        text: "لطفاً تماس بگیرید",
        firstName: "Consult",
      },
      client,
      "telegram",
    );

    expect(
      client.messages.some((message) =>
        message.text.includes("درخواست مشاوره شما ثبت شد"),
      ),
    ).toBe(true);

    const conversation = await db.botConversation.findUnique({
      where: {
        platform_chatId: { platform: "telegram", chatId },
      },
    });

    expect(conversation?.state).toBe("at_main_menu");
  });
});
