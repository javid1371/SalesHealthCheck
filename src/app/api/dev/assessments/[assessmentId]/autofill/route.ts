import { handleApiRequest } from "@/lib/api-handler";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  finishAssessment,
  getAssessmentQuestions,
  saveAnswers,
} from "@/modules/assessment/assessment.service";
import type { SaveAnswerInput } from "@/modules/assessment/assessment.types";
import type { QuestionDto } from "@/modules/question-bank/question-bank.types";

type AutofillStrategy = "random" | "weak" | "strong" | "mixed";

interface DevAutofillResponse {
  assessmentId: string;
  savedAnswers: number;
  strategy: AutofillStrategy;
  reportId: string;
  resultUrl: string;
}

const AUTOFILL_STRATEGIES = new Set<AutofillStrategy>([
  "random",
  "weak",
  "strong",
  "mixed",
]);

function assertDevOnly() {
  if (env.nodeEnv === "production") {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

function parseStrategy(body: unknown): AutofillStrategy {
  if (!body || typeof body !== "object") return "random";

  const { strategy } = body as Record<string, unknown>;
  if (typeof strategy !== "string") return "random";

  return AUTOFILL_STRATEGIES.has(strategy as AutofillStrategy)
    ? (strategy as AutofillStrategy)
    : "random";
}

function pickOption(question: QuestionDto, strategy: AutofillStrategy) {
  if (question.options.length === 0) {
    throw new AppError(
      "questions_not_found",
      "Question has no selectable options",
      500,
      { questionId: question.id },
    );
  }

  const optionsByScore = [...question.options].sort((a, b) => a.score - b.score);

  if (strategy === "weak") return optionsByScore[0];
  if (strategy === "strong") return optionsByScore[optionsByScore.length - 1];

  if (strategy === "mixed") {
    const middleIndex = Math.floor(optionsByScore.length / 2);
    return optionsByScore[middleIndex];
  }

  return question.options[Math.floor(Math.random() * question.options.length)];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return handleApiRequest<DevAutofillResponse>(async () => {
    assertDevOnly();

    const strategy = parseStrategy(body);
    const questionsData = await getAssessmentQuestions(assessmentId);
    const answers: SaveAnswerInput[] = questionsData.domains.flatMap((domain) =>
      domain.questions.map((question) => ({
        questionId: question.id,
        selectedOptionId: pickOption(question, strategy).id,
      })),
    );

    const saved = await saveAnswers(assessmentId, { answers });
    const finished = await finishAssessment(assessmentId, {
      generateAiExplanation: false,
    });

    return {
      assessmentId,
      savedAnswers: saved.savedAnswers,
      strategy,
      reportId: finished.reportId,
      resultUrl: finished.resultUrl,
    };
  });
}
