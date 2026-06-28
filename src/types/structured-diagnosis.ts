export type VitalityTier = "survival" | "foundation" | "engine" | "growth";

export type DomainLevel =
  | "critical"
  | "weak"
  | "medium"
  | "healthy"
  | "advanced";

export type SubdomainPattern = "pervasive" | "pinpoint" | "uneven";

export type SurvivalStatus = "RED" | "AMBER" | "GREEN";

export type DiagnosisConfidence = "low" | "medium" | "high";

export interface PerDomainDiagnosis {
  engineId: number;
  domainSlug: string;
  displayOrder: number;
  raw: number;
  pct: number;
  gap: number;
  level: DomainLevel;
  W: number;
  M: number;
  PI: number;
  tier: VitalityTier;
  incomplete: boolean;
  flags: string[];
}

export interface WeakQuestion {
  engineId: number;
  displayOrder: number;
  domainSlug: string;
  questionNumber: number;
  score: number;
  diagnosticIntent: string;
}

export interface GateAlert {
  engineId: number;
  displayOrder: number;
  domainSlug: string;
  questionNumber: number;
  score: number;
  diagnosticIntent: string;
}

export interface IssueRootQuestion {
  engineId: number;
  displayOrder: number;
  domainSlug: string;
  questionNumber: number;
  score: number;
  diagnosticIntent: string;
  role: "primary_issue" | "structural_root" | "quick_win";
}

export interface PriorityLadderEntry {
  engineId: number;
  domainSlug: string;
  priorityTier: 0 | 1 | 2;
  reason: string;
}

export interface DependencyFinding {
  rootEngineId: number;
  symptomEngineId: number;
  rootSlug: string;
  symptomSlug: string;
  weight: number;
}

export interface IssueFamily {
  key: string;
  label: string;
  engineIds: number[];
  averagePct: number;
}

export interface StructuredDiagnosis {
  engineVersion: "v2";
  perDomain: PerDomainDiagnosis[];
  weakQuestions: WeakQuestion[];
  subdomainPattern: Record<number, SubdomainPattern>;
  gateAlerts: GateAlert[];
  issueRootQuestions: IssueRootQuestion[];
  priorityLadder: PriorityLadderEntry[];
  healthFlat: number;
  healthWeighted: number;
  survivalStatus: SurvivalStatus;
  survivalAlerts: Array<{
    engineId: number;
    domainSlug: string;
    flag: "RED" | "AMBER";
    pct: number;
  }>;
  primaryIssue: number | null;
  structuralRoots: number[];
  quickWin: number | null;
  bindingConstraint: number | null;
  dependencyFindings: DependencyFinding[];
  issueFamilies: IssueFamily[];
  confidence: DiagnosisConfidence;
  instrumentFirst: boolean;
  incompleteDomains: number[];
}
