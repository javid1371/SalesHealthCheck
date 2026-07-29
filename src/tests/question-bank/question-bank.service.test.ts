import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/question-bank/question-bank.repository", () => ({
  findActiveModelVersion: vi.fn(),
  findModelVersionById: vi.fn(),
  findOptionById: vi.fn(),
  findOptionsByIds: vi.fn(),
  findQuestionById: vi.fn(),
  findQuestionsByIds: vi.fn(),
  loadDomainsWithQuestions: vi.fn(),
}));

import {
  findOptionsByIds,
  findQuestionsByIds,
} from "@/modules/question-bank/question-bank.repository";
import { validateAnswersBatch } from "@/modules/question-bank/question-bank.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateAnswersBatch", () => {
  it("loads questions and options once and returns scores", async () => {
    vi.mocked(findQuestionsByIds).mockResolvedValue([
      { id: "q1", modelVersionId: "model-1" },
      { id: "q2", modelVersionId: "model-1" },
    ] as never);
    vi.mocked(findOptionsByIds).mockResolvedValue([
      { id: "o1", questionId: "q1", score: 3 },
      { id: "o2", questionId: "q2", score: 2 },
    ] as never);

    const result = await validateAnswersBatch(
      [
        { questionId: "q1", selectedOptionId: "o1" },
        { questionId: "q2", selectedOptionId: "o2" },
      ],
      "model-1",
    );

    expect(findQuestionsByIds).toHaveBeenCalledOnce();
    expect(findQuestionsByIds).toHaveBeenCalledWith(["q1", "q2"]);
    expect(findOptionsByIds).toHaveBeenCalledOnce();
    expect(findOptionsByIds).toHaveBeenCalledWith(["o1", "o2"]);
    expect(result).toEqual([
      { questionId: "q1", selectedOptionId: "o1", score: 3 },
      { questionId: "q2", selectedOptionId: "o2", score: 2 },
    ]);
  });

  it("rejects option that does not belong to question", async () => {
    vi.mocked(findQuestionsByIds).mockResolvedValue([
      { id: "q1", modelVersionId: "model-1" },
    ] as never);
    vi.mocked(findOptionsByIds).mockResolvedValue([
      { id: "wrong-option", questionId: "q-other", score: 1 },
    ] as never);

    await expect(
      validateAnswersBatch(
        [{ questionId: "q1", selectedOptionId: "wrong-option" }],
        "model-1",
      ),
    ).rejects.toMatchObject({
      code: "option_does_not_belong_to_question",
      status: 409,
    });
  });

  it("rejects question from a different model version", async () => {
    vi.mocked(findQuestionsByIds).mockResolvedValue([
      { id: "q1", modelVersionId: "other-model" },
    ] as never);
    vi.mocked(findOptionsByIds).mockResolvedValue([
      { id: "o1", questionId: "q1", score: 3 },
    ] as never);

    await expect(
      validateAnswersBatch(
        [{ questionId: "q1", selectedOptionId: "o1" }],
        "model-1",
      ),
    ).rejects.toMatchObject({
      code: "question_does_not_belong_to_model_version",
      status: 409,
    });
  });
});
