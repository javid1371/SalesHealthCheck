import { AppError } from "@/lib/errors";
import {
  findActiveModelVersion,
  findModelVersionById,
  findOptionById,
  findQuestionById,
  loadDomainsWithQuestions,
} from "./question-bank.repository";
import type { QuestionsForAssessmentDto } from "./question-bank.types";

export async function loadActiveModelVersion() {
  const modelVersion = await findActiveModelVersion();

  if (!modelVersion) {
    throw new AppError(
      "active_model_version_not_found",
      "No active model version found",
      404,
    );
  }

  return modelVersion;
}

export async function loadQuestionsForAssessment(
  assessmentId: string,
  modelVersionId: string,
): Promise<QuestionsForAssessmentDto> {
  const modelVersion = await findModelVersionById(modelVersionId);

  if (!modelVersion) {
    throw new AppError(
      "questions_not_found",
      "Questions not found for this assessment",
      404,
    );
  }

  const domains = await loadDomainsWithQuestions(modelVersionId);

  if (domains.length === 0) {
    throw new AppError(
      "questions_not_found",
      "Questions not found for this assessment",
      404,
    );
  }

  return {
    assessmentId,
    modelVersion: {
      id: modelVersion.id,
      versionNumber: modelVersion.versionNumber,
      name: modelVersion.name,
    },
    domains: domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      layer: {
        id: domain.layer.id,
        slug: domain.layer.slug,
        name: domain.layer.name,
      },
      displayOrder: domain.displayOrder,
      questions: domain.questions.map((question) => ({
        id: question.id,
        text: question.text,
        displayOrder: question.displayOrder,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
          score: option.score,
          displayOrder: option.displayOrder,
        })),
      })),
    })),
  };
}

export async function validateQuestionBelongsToModelVersion(
  questionId: string,
  modelVersionId: string,
) {
  const question = await findQuestionById(questionId);

  if (!question) {
    throw new AppError(
      "question_not_found",
      "Question not found",
      404,
      { questionId },
    );
  }

  if (question.modelVersionId !== modelVersionId) {
    throw new AppError(
      "question_does_not_belong_to_model_version",
      "Question does not belong to this assessment model version",
      409,
      { questionId },
    );
  }

  return question;
}

export async function validateOptionBelongsToQuestion(
  optionId: string,
  questionId: string,
) {
  const option = await findOptionById(optionId);

  if (!option) {
    throw new AppError(
      "option_not_found",
      "Option not found",
      404,
      { optionId },
    );
  }

  if (option.questionId !== questionId) {
    throw new AppError(
      "option_does_not_belong_to_question",
      "Option does not belong to the specified question",
      409,
      { optionId, questionId },
    );
  }

  return option;
}
