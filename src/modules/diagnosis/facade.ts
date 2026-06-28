import type {
  BottleneckResult,
  DiagnosisResult,
  LayerStatusResult,
} from "@/types/diagnosis";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { DomainScoreResult, LayerScoreResult } from "@/types/scoring";
import { getQuestionAnalysis } from "@/config/model-v1/question-analysis-config";
import { domainsV1 } from "@/config/model-v1/domains";
import type {
  DiagnosisAnswerInput,
  DiagnosisDomainInput,
  DiagnosisEngineVersion,
  DiagnosisLayerInput,
} from "./diagnosis.types";
import { runDiagnosis as runDiagnosisV1 } from "./v1/diagnosis.engine";
import { runDiagnosisV2 } from "./v2/run-diagnosis-v2";
import { toLegacyBottlenecks, toLegacyDiagnoses } from "./adapter/to-legacy-bottlenecks";

export type RunDiagnosisParams = {
  engineVersion: DiagnosisEngineVersion;
  domainScores: DomainScoreResult[];
  layerScores: LayerScoreResult[];
  domains: DiagnosisDomainInput[];
  layers: DiagnosisLayerInput[];
  answers?: DiagnosisAnswerInput[];
};

export type RunDiagnosisOutput = {
  engineVersion: DiagnosisEngineVersion;
  structuredDiagnosis?: StructuredDiagnosis;
  bottlenecks: BottleneckResult[];
  layerStatuses: LayerStatusResult[];
  diagnoses: DiagnosisResult[];
};

function slugToDisplayOrder(slug: string): number {
  const domain = domainsV1.find((entry) => entry.slug === slug);
  if (!domain) {
    throw new Error(`Unknown domain slug for diagnosis v2: ${slug}`);
  }
  return domain.displayOrder;
}

function buildV2Answers(answers: DiagnosisAnswerInput[]) {
  return answers.map((answer) => {
    const analysis = getQuestionAnalysis(answer.domainSlug, answer.questionNumber);
    return {
      displayOrder: answer.displayOrder ?? slugToDisplayOrder(answer.domainSlug),
      questionNumber: answer.questionNumber,
      score: answer.score as 0 | 1 | 2 | 3,
      domainSlug: answer.domainSlug,
      diagnosticIntent: answer.diagnosticIntent ?? analysis?.diagnosticIntent ?? "",
    };
  });
}

export function runDiagnosis(params: RunDiagnosisParams): RunDiagnosisOutput {
  if (params.engineVersion === "v1") {
    const v1Result = runDiagnosisV1(
      params.domainScores,
      params.layerScores,
      params.domains,
      params.layers,
    );

    return {
      engineVersion: "v1",
      ...v1Result,
    };
  }

  const structuredDiagnosis = runDiagnosisV2({
    answers: buildV2Answers(params.answers ?? []),
  });

  const v1LayerStatuses = runDiagnosisV1(
    params.domainScores,
    params.layerScores,
    params.domains,
    params.layers,
  ).layerStatuses;

  return {
    engineVersion: "v2",
    structuredDiagnosis,
    bottlenecks: toLegacyBottlenecks(structuredDiagnosis, params.domains),
    layerStatuses: v1LayerStatuses,
    diagnoses: toLegacyDiagnoses(structuredDiagnosis, params.domains),
  };
}

export {
  BOTTLENECK_COUNT,
  calculateBottlenecks,
  calculateLayerStatuses,
  produceDiagnoses,
} from "./v1/diagnosis.engine";
