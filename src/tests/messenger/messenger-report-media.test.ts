import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BotClient } from "@/modules/messenger/bot/bot-client.types";
import { handleMessengerUpdate } from "@/modules/messenger/messenger.service";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    pdfGenerationEnabled: false,
    appBaseUrl: "http://localhost:3000",
  },
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/modules/report/report-image.service", () => ({
  generateReportChartImage: vi.fn(),
}));

vi.mock("@/modules/report/report-pdf.service", () => ({
  generateReportPdf: vi.fn(),
}));

vi.mock("@/modules/assessment/assessment.service", () => ({
  getAssessmentResult: vi.fn(),
}));

vi.mock("@/modules/assessment/assessment.repository", () => ({
  findAssessmentById: vi.fn(),
}));

vi.mock("@/modules/messenger/messenger.repository", () => ({
  findOrCreateConversation: vi.fn(),
  updateConversation: vi.fn(),
}));

import { findAssessmentById } from "@/modules/assessment/assessment.repository";
import { getAssessmentResult } from "@/modules/assessment/assessment.service";
import { generateReportChartImage } from "@/modules/report/report-image.service";
import { generateReportPdf } from "@/modules/report/report-pdf.service";
import {
  findOrCreateConversation,
  updateConversation,
} from "@/modules/messenger/messenger.repository";

const mockFindAssessmentById = vi.mocked(findAssessmentById);
const mockGetAssessmentResult = vi.mocked(getAssessmentResult);
const mockGenerateReportChartImage = vi.mocked(generateReportChartImage);
const mockGenerateReportPdf = vi.mocked(generateReportPdf);
const mockFindOrCreateConversation = vi.mocked(findOrCreateConversation);
const mockUpdateConversation = vi.mocked(updateConversation);

function createTrackingClient(): BotClient & {
  messages: string[];
  photos: number[];
  documents: number[];
} {
  const messages: string[] = [];
  const photos: number[] = [];
  const documents: number[] = [];

  return {
    messages,
    photos,
    documents,
    async sendMessage({ text }) {
      messages.push(text);
      return { messageId: String(messages.length) };
    },
    async answerCallbackQuery() {},
    async editMessageReplyMarkup() {},
    async sendPhoto({ photo }) {
      photos.push(photo.length);
      return { messageId: "photo" };
    },
    async sendDocument({ document }) {
      documents.push(document.length);
      return { messageId: "doc" };
    },
  };
}

describe("messenger report media", () => {
  const conversation = {
    id: "conv-1",
    chatId: "chat-1",
    userId: "user-1",
    state: "at_main_menu" as const,
    assessmentId: null,
    currentDomainIndex: 0,
    currentQuestionIndex: 0,
    lastPromptMessageId: null,
    businessName: null,
    teamSize: null,
    contactFirstName: null,
    platform: "telegram" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.pdfGenerationEnabled = false;
    mockFindOrCreateConversation.mockResolvedValue(conversation);
    mockUpdateConversation.mockImplementation(async (_id, data) => ({
      ...conversation,
      ...data,
    }));
  });

  it("sends text report only when pdfGenerationEnabled is false", async () => {
    mockFindAssessmentById.mockResolvedValue({
      id: "assessment-1",
      userId: "user-1",
      status: "completed",
      resultToken: "token-1",
      report: { id: "report-1" },
    } as Awaited<ReturnType<typeof findAssessmentById>>);

    mockGetAssessmentResult.mockResolvedValue({
      overallScore: { percentage: 55, healthLevel: "medium" },
      domainScores: [],
      layerScores: [],
      spiderChartData: [],
      diagnoses: [],
      report: {
        overallSummary: "خلاصه",
        layerSummaries: [],
        bottleneckSummaries: [],
        domainResults: [],
        correctiveActions: [],
      },
    } as Awaited<ReturnType<typeof getAssessmentResult>>);

    const client = createTrackingClient();

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId: "chat-1",
        callbackQueryId: "cb-report",
        data: "report:assessment-1",
        messageId: "1",
      },
      client,
      "telegram",
    );

    expect(client.messages.some((text) => text.includes("گزارش ارزیابی"))).toBe(true);
    expect(mockGenerateReportChartImage).not.toHaveBeenCalled();
    expect(client.photos).toHaveLength(0);
    expect(
      client.messages.some((text) => text.includes("برای اقدام بعدی")),
    ).toBe(true);
  });

  it("sends chart photo when pdfGenerationEnabled is true", async () => {
    mockEnv.pdfGenerationEnabled = true;

    mockFindAssessmentById.mockResolvedValue({
      id: "assessment-1",
      userId: "user-1",
      status: "completed",
      resultToken: "token-1",
      report: { id: "report-1" },
    } as Awaited<ReturnType<typeof findAssessmentById>>);

    mockGetAssessmentResult.mockResolvedValue({
      overallScore: { percentage: 55, healthLevel: "medium" },
      domainScores: [],
      layerScores: [],
      spiderChartData: [],
      diagnoses: [],
      report: {
        overallSummary: "خلاصه",
        layerSummaries: [],
        bottleneckSummaries: [],
        domainResults: [],
        correctiveActions: [],
      },
    } as Awaited<ReturnType<typeof getAssessmentResult>>);

    mockGenerateReportChartImage.mockResolvedValue(Buffer.from("png"));

    const client = createTrackingClient();

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId: "chat-1",
        callbackQueryId: "cb-report",
        data: "report:assessment-1",
        messageId: "1",
      },
      client,
      "telegram",
    );

    expect(mockGenerateReportChartImage).toHaveBeenCalledWith("report-1", {
      token: "token-1",
    });
    expect(client.photos).toEqual([3]);
  });

  it("sends pdf document when pdf callback is clicked", async () => {
    mockEnv.pdfGenerationEnabled = true;

    mockFindAssessmentById.mockResolvedValue({
      id: "assessment-1",
      userId: "user-1",
      status: "completed",
      resultToken: "token-1",
      report: { id: "report-1" },
    } as Awaited<ReturnType<typeof findAssessmentById>>);

    mockGenerateReportPdf.mockResolvedValue(Buffer.from("%PDF"));

    const client = createTrackingClient();

    await handleMessengerUpdate(
      {
        type: "callback",
        chatId: "chat-1",
        callbackQueryId: "cb-pdf",
        data: "pdf:assessment-1",
        messageId: "2",
      },
      client,
      "telegram",
    );

    expect(mockGenerateReportPdf).toHaveBeenCalledWith("report-1", {
      token: "token-1",
    });
    expect(client.documents).toEqual([4]);
    expect(
      client.messages.some((text) => text.includes("در حال آماده‌سازی فایل PDF")),
    ).toBe(true);
  });
});
