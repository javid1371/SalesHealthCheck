export type DiagnosisEngineVersion = "v1" | "v2";

export interface DiagnosisDomainInput {
  id: string;
  slug: string;
  name: string;
  weight: number;
  displayOrder?: number;
}

export interface DiagnosisLayerInput {
  id: string;
  slug: string;
  name: string;
}

export interface DiagnosisAnswerInput {
  displayOrder?: number;
  domainSlug: string;
  questionNumber: number;
  score: number;
  diagnosticIntent?: string;
}

export interface DiagnosisInput {
  engineVersion?: DiagnosisEngineVersion;
  domainScores: import("@/types/scoring").DomainScoreResult[];
  layerScores: import("@/types/scoring").LayerScoreResult[];
  domains: DiagnosisDomainInput[];
  layers: DiagnosisLayerInput[];
  answers?: DiagnosisAnswerInput[];
}
