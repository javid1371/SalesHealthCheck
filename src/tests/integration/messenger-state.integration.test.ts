import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { BotClient } from "@/modules/messenger/bot/bot-client.types";
import { handleMessengerUpdate } from "@/modules/messenger/messenger.service";
import {
  getAssessmentQuestions,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";

vi.mock("@/modules/assessment/assessment.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/assessment/assessment.service")>();
  return {
    ...actual,
    startAssessment: vi.fn(),
    getAssessmentQuestions: vi.fn(),
    saveAnswers: vi.fn(),
    finishAssessment: vi.fn(),
    getAssessmentResult: vi.fn(),
  };
});

const mockedStartAssessment = vi.mocked(startAssessment);
const mockedGetAssessmentQuestions = vi.mocked(getAssessmentQuestions);
const mockedSaveAnswers = vi.mocked(saveAnswers);

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

describe("handleMessengerUpdate (integration state machine)", () => {
  const chatId = `chat-${Date.now()}`;

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.botConversation.deleteMany({
      where: { platform: "telegram", chatId },
    });
  });

  it("moves from /start to business name after contact share", async () => {
    const client = createFakeClient();

    await handleMessengerUpdate(
      { type: "command", chatId, command: "start", firstName: "Javid" },
      client,
      "telegram",
    );

    expect(client.messages.at(-1)?.text).toContain("شماره تماس");

    const user = await db.user.create({
      data: {
        phone: `0912${String(Date.now()).slice(-7)}`,
        phoneVerifiedAt: new Date(),
      },
    });

    vi.spyOn(
      await import("@/modules/messenger/messenger-auth.service"),
      "resolveUserFromContactPhone",
    ).mockResolvedValue({
      userId: user.id,
      normalizedPhone: user.phone!,
    });

    await handleMessengerUpdate(
      {
        type: "contact",
        chatId,
        phone: user.phone!,
        firstName: "Javid",
      },
      client,
      "telegram",
    );

    expect(client.messages.at(-1)?.text).toContain("نام کسب‌وکار");
  });

  it("starts assessment after sales model selection callback", async () => {
    const client = createFakeClient();
    const user = await db.user.create({
      data: {
        phone: `0913${String(Date.now()).slice(-7)}`,
        phoneVerifiedAt: new Date(),
      },
    });

    await db.botConversation.create({
      data: {
        platform: "telegram",
        chatId,
        userId: user.id,
        businessName: "Test Biz",
        teamSize: "1-5",
        state: "awaiting_sales_model",
      },
    });

    mockedStartAssessment.mockResolvedValue({
      assessmentId: "assessment-test-1",
      status: "started",
      resultToken: "token-1",
      modelVersion: { id: "mv-1", versionNumber: "1.0" },
      nextStep: "questions",
    });

    mockedGetAssessmentQuestions.mockResolvedValue({
      assessmentId: "assessment-test-1",
      modelVersion: { id: "mv-1", versionNumber: "1.0", name: "v1" },
      domains: [
        {
          id: "d1",
          name: "Domain 1",
          slug: "domain-1",
          layer: { id: "l1", slug: "layer-1", name: "Layer 1" },
          displayOrder: 1,
          questions: [
            {
              id: "q1",
              text: "Question 1?",
              displayOrder: 1,
              options: [
                { id: "opt1", text: "A", score: 0, displayOrder: 1 },
                { id: "opt2", text: "B", score: 1, displayOrder: 2 },
              ],
            },
          ],
        },
      ],
    });

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId,
        callbackQueryId: "cb-1",
        data: "model:online",
        messageId: "10",
      },
      client,
      "telegram",
    );

    expect(mockedStartAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: expect.objectContaining({
          businessName: "Test Biz",
          teamSize: "1-5",
          salesModel: "online",
        }),
      }),
      { userId: user.id },
    );

    expect(
      client.messages.some((message) => message.text.includes("Question 1?")),
    ).toBe(true);
  });

  it("saves answer callback and sends next question", async () => {
    const client = createFakeClient();

    await db.botConversation.create({
      data: {
        platform: "telegram",
        chatId,
        assessmentId: "assessment-test-2",
        state: "answering_questions",
        currentDomainIndex: 0,
        currentQuestionIndex: 0,
      },
    });

    mockedGetAssessmentQuestions.mockResolvedValue({
      assessmentId: "assessment-test-2",
      modelVersion: { id: "mv-1", versionNumber: "1.0", name: "v1" },
      domains: [
        {
          id: "d1",
          name: "Domain 1",
          slug: "domain-1",
          layer: { id: "l1", slug: "layer-1", name: "Layer 1" },
          displayOrder: 1,
          questions: [
            {
              id: "q1",
              text: "Question 1?",
              displayOrder: 1,
              options: [
                { id: "opt1", text: "A", score: 0, displayOrder: 1 },
                { id: "opt2", text: "B", score: 1, displayOrder: 2 },
              ],
            },
            {
              id: "q2",
              text: "Question 2?",
              displayOrder: 2,
              options: [{ id: "opt3", text: "C", score: 0, displayOrder: 1 }],
            },
          ],
        },
      ],
    });

    mockedSaveAnswers.mockResolvedValue({
      assessmentId: "assessment-test-2",
      savedAnswers: 1,
      progress: {
        answeredQuestions: 1,
        totalQuestions: 2,
        percentage: 50,
      },
    });

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId,
        callbackQueryId: "cb-2",
        data: "opt1",
        messageId: "11",
      },
      client,
      "telegram",
    );

    expect(mockedSaveAnswers).toHaveBeenCalledWith("assessment-test-2", {
      answers: [{ questionId: "q1", selectedOptionId: "opt1" }],
    });

    expect(
      client.messages.some((message) => message.text.includes("Question 2?")),
    ).toBe(true);
  });
});
