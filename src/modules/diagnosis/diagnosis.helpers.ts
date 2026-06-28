import type { DiagnosisEngineVersion } from "@/modules/diagnosis/diagnosis.types";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { StructuredReport } from "@/types/report";
import { ENGINE_ID_TO_SLUG } from "@/config/model-v1/diagnosis-engine-v2";

export function buildDiagnosisSummary(
  structured: StructuredDiagnosis,
  domainNames: Map<string, string>,
): NonNullable<StructuredReport["diagnosisSummary"]> {
  const slugForEngineId = (engineId: number | null | undefined) => {
    if (engineId == null) return undefined;
    return ENGINE_ID_TO_SLUG[engineId];
  };

  const nameForEngineId = (engineId: number | null | undefined) => {
    const slug = slugForEngineId(engineId);
    if (!slug) return undefined;
    return domainNames.get(slug) ?? slug;
  };

  return {
    survivalStatus: structured.survivalStatus,
    healthWeighted: Math.round(structured.healthWeighted * 1000) / 10,
    healthFlat: Math.round(structured.healthFlat * 1000) / 10,
    primaryIssue: structured.primaryIssue
      ? {
          engineId: structured.primaryIssue,
          domainSlug: slugForEngineId(structured.primaryIssue) ?? "",
          domainName: nameForEngineId(structured.primaryIssue) ?? "",
        }
      : null,
    structuralRoots: structured.structuralRoots.map((engineId) => ({
      engineId,
      domainSlug: slugForEngineId(engineId) ?? "",
      domainName: nameForEngineId(engineId) ?? "",
    })),
    quickWin: structured.quickWin
      ? {
          engineId: structured.quickWin,
          domainSlug: slugForEngineId(structured.quickWin) ?? "",
          domainName: nameForEngineId(structured.quickWin) ?? "",
        }
      : null,
    bindingConstraint: structured.bindingConstraint
      ? {
          engineId: structured.bindingConstraint,
          domainSlug: slugForEngineId(structured.bindingConstraint) ?? "",
          domainName: nameForEngineId(structured.bindingConstraint) ?? "",
        }
      : null,
    confidence: structured.confidence,
    instrumentFirst: structured.instrumentFirst,
    issueRootQuestions: structured.issueRootQuestions.map((question) => ({
      domainSlug: question.domainSlug,
      questionNumber: question.questionNumber,
      diagnosticIntent: question.diagnosticIntent,
      role: question.role,
    })),
  };
}

export function buildAnalysisContextFromDiagnosis(
  structured: StructuredDiagnosis,
  domainScores: Array<{ domainSlug: string; rawScore: number }>,
): NonNullable<StructuredReport["analysisContext"]> {
  return {
    perQuestion: structured.weakQuestions.map((question) => ({
      domainSlug: question.domainSlug,
      questionNumber: question.questionNumber,
      diagnosticIntent: question.diagnosticIntent,
      selectedScore: question.score,
      selectedInterpretation: "",
    })),
    domainInterpretations: domainScores.map((score) => {
      const perDomain = structured.perDomain.find(
        (domain) => domain.domainSlug === score.domainSlug,
      );
      return {
        domainSlug: score.domainSlug,
        rawScore: score.rawScore,
        bandLabel: perDomain?.level ?? "",
        bandDescription: "",
      };
    }),
  };
}

export function resolveDiagnosisEngineVersion(
  value: string | null | undefined,
): DiagnosisEngineVersion {
  return value === "v2" ? "v2" : "v1";
}
