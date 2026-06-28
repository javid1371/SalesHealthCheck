import { GATE_QUESTIONS } from "@/config/model-v1/diagnosis-engine-v2";
import type {
  GateAlert,
  SubdomainPattern,
  WeakQuestion,
} from "@/types/structured-diagnosis";
import type { NormalizedDomain } from "./normalize";

export type QuestionMetadata = {
  engineId: number;
  displayOrder: number;
  domainSlug: string;
  questionNumber: number;
  score: number;
  diagnosticIntent: string;
};

export type QuestionAnalysisResult = {
  weakQuestions: WeakQuestion[];
  gateAlerts: GateAlert[];
  subdomainPattern: Record<number, SubdomainPattern>;
  patternMultiplier: Record<number, number>;
};

function isQuestionWeak(score: number): boolean {
  return score <= 1;
}

export function detectSubdomainPattern(scores: number[]): SubdomainPattern {
  const allWeak = scores.every((score) => score <= 1);
  if (allWeak) return "pervasive";

  const spread = Math.max(...scores) - Math.min(...scores);
  const hasWeak = scores.some(isQuestionWeak);
  const hasStrong = scores.some((score) => score >= 2);

  if (spread >= 2 && hasWeak && hasStrong) {
    return "pinpoint";
  }

  return "uneven";
}

export function analyzeQuestions(
  normalized: Record<number, NormalizedDomain>,
  questionMetadata: QuestionMetadata[],
): QuestionAnalysisResult {
  const weakQuestions: WeakQuestion[] = [];
  const gateAlerts: GateAlert[] = [];
  const subdomainPattern: Record<number, SubdomainPattern> = {};
  const patternMultiplier: Record<number, number> = {};

  for (const domain of Object.values(normalized)) {
    if (domain.incomplete) continue;

    const pattern = detectSubdomainPattern(domain.scores);
    subdomainPattern[domain.engineId] = pattern;
    patternMultiplier[domain.engineId] = pattern === "pervasive" ? 1.25 : 1;
  }

  for (const question of questionMetadata) {
    if (isQuestionWeak(question.score)) {
      weakQuestions.push({
        engineId: question.engineId,
        displayOrder: question.displayOrder,
        domainSlug: question.domainSlug,
        questionNumber: question.questionNumber,
        score: question.score,
        diagnosticIntent: question.diagnosticIntent,
      });
    }

    const isGate = GATE_QUESTIONS.some(
      (gate) =>
        gate.engineId === question.engineId &&
        gate.questionNumber === question.questionNumber,
    );

    if (isGate && question.score === 0) {
      gateAlerts.push({
        engineId: question.engineId,
        displayOrder: question.displayOrder,
        domainSlug: question.domainSlug,
        questionNumber: question.questionNumber,
        score: question.score,
        diagnosticIntent: question.diagnosticIntent,
      });
    }
  }

  weakQuestions.sort((a, b) => {
    if (a.engineId !== b.engineId) return a.engineId - b.engineId;
    if (a.score !== b.score) return a.score - b.score;
    return a.questionNumber - b.questionNumber;
  });

  return {
    weakQuestions,
    gateAlerts,
    subdomainPattern,
    patternMultiplier,
  };
}
