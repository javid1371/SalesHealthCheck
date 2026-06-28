import {
  displayOrderToEngineId,
  ENGINE_IDS,
  ENGINE_ID_TO_DISPLAY_ORDER,
  ENGINE_ID_TO_SLUG,
} from "@/config/model-v1/diagnosis-engine-v2";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import {
  calculateConstraintBonus,
  findBindingConstraint,
} from "./layers/binding-constraint";
import { calculateDependencyMetrics } from "./layers/dependency-graph";
import { normalizeDomainScores } from "./layers/normalize";
import { buildFinalOutputs } from "./layers/outputs";
import { calculatePriorityIndex } from "./layers/priority-index";
import {
  analyzeQuestions,
  type QuestionMetadata,
} from "./layers/question-analysis";
import {
  calculateHealthMetrics,
  evaluateSurvivalGate,
} from "./layers/survival-gate";

export type DiagnosisV2AnswerInput = {
  displayOrder: number;
  questionNumber: number;
  score: 0 | 1 | 2 | 3;
  diagnosticIntent?: string;
  domainSlug?: string;
};

export type RunDiagnosisV2Input = {
  answers: DiagnosisV2AnswerInput[];
};

export type RunDiagnosisV2FromRawInput = {
  /** Domain-level raw scores keyed by engine_id (for snapshot tests). */
  rawByEngineId: Record<number, number>;
};

function buildMatrixFromAnswers(
  answers: DiagnosisV2AnswerInput[],
): {
  matrix: Record<number, number[]>;
  incompleteDomains: number[];
  questionMetadata: QuestionMetadata[];
} {
  const matrix: Record<number, number[]> = {};
  const answeredCounts: Record<number, number> = {};

  for (const engineId of ENGINE_IDS) {
    matrix[engineId] = [0, 0, 0, 0, 0];
    answeredCounts[engineId] = 0;
  }

  const questionMetadata: QuestionMetadata[] = [];

  for (const answer of answers) {
    const engineId = displayOrderToEngineId(answer.displayOrder);
    const index = answer.questionNumber - 1;
    if (index < 0 || index > 4) continue;

    matrix[engineId][index] = answer.score;
    answeredCounts[engineId] += 1;

    questionMetadata.push({
      engineId,
      displayOrder: answer.displayOrder,
      domainSlug: answer.domainSlug ?? ENGINE_ID_TO_SLUG[engineId],
      questionNumber: answer.questionNumber,
      score: answer.score,
      diagnosticIntent: answer.diagnosticIntent ?? "",
    });
  }

  const incompleteDomains = ENGINE_IDS.filter((engineId) => answeredCounts[engineId] < 4);

  return { matrix, incompleteDomains, questionMetadata };
}

function buildMatrixFromRawScores(
  rawByEngineId: Record<number, number>,
): {
  matrix: Record<number, number[]>;
  incompleteDomains: number[];
  questionMetadata: QuestionMetadata[];
} {
  const matrix: Record<number, number[]> = {};

  for (const engineId of ENGINE_IDS) {
    const raw = rawByEngineId[engineId] ?? 0;
    const base = Math.floor(raw / 5);
    const remainder = raw % 5;
    matrix[engineId] = Array.from({ length: 5 }, (_, index) =>
      index < remainder ? base + 1 : base,
    );
  }

  return { matrix, incompleteDomains: [], questionMetadata: [] };
}

function runWithMatrix(
  matrix: Record<number, number[]>,
  incompleteDomains: number[],
  questionMetadata: QuestionMetadata[],
): StructuredDiagnosis {
  const normalized = normalizeDomainScores(matrix, incompleteDomains);
  const questionAnalysis = analyzeQuestions(normalized, questionMetadata);
  if (questionMetadata.length === 0) {
    for (const engineId of Object.keys(questionAnalysis.patternMultiplier).map(Number)) {
      questionAnalysis.patternMultiplier[engineId] = 1;
    }
    questionAnalysis.subdomainPattern = {};
  }
  const survivalResult = evaluateSurvivalGate(normalized, ENGINE_ID_TO_SLUG);
  const { healthFlat, healthWeighted } = calculateHealthMetrics(normalized);
  const useWeightedGraph = questionMetadata.length > 0;
  const { mCoefficients, dependencyFindings } = calculateDependencyMetrics(
    normalized,
    ENGINE_ID_TO_SLUG,
    useWeightedGraph,
  );
  const bindingConstraint = findBindingConstraint(normalized);
  const constraintBonus = calculateConstraintBonus(normalized, bindingConstraint);
  const perDomain = calculatePriorityIndex(
    normalized,
    mCoefficients,
    questionAnalysis.patternMultiplier,
    constraintBonus,
    ENGINE_ID_TO_SLUG,
    ENGINE_ID_TO_DISPLAY_ORDER,
  );

  return buildFinalOutputs({
    perDomain,
    questionAnalysis,
    survivalResult,
    healthFlat,
    healthWeighted,
    bindingConstraint,
    dependencyFindings,
    incompleteDomains,
  });
}

export function runDiagnosisV2(input: RunDiagnosisV2Input): StructuredDiagnosis {
  const { matrix, incompleteDomains, questionMetadata } = buildMatrixFromAnswers(
    input.answers,
  );
  return runWithMatrix(matrix, incompleteDomains, questionMetadata);
}

export function runDiagnosisV2FromRawScores(
  input: RunDiagnosisV2FromRawInput,
): StructuredDiagnosis {
  const { matrix, incompleteDomains, questionMetadata } = buildMatrixFromRawScores(
    input.rawByEngineId,
  );
  return runWithMatrix(matrix, incompleteDomains, questionMetadata);
}
