import type {
  SurvivalStatus,
  DiagnosisConfidence,
  DomainLevel,
  VitalityTier,
} from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";

export type { ValueAtStakeSpec };

export type CapacityMode = "free" | "full";
export type ToneMode = "urgent" | "serious" | "optimization" | "honesty";

export interface ReportSpec {
  survivalBanner: { status: SurvivalStatus; tone: ToneMode };
  healthDisplay: number; // healthWeighted as percentage (0..100)

  charts: ReportChart[];

  quickWinTeaser: { domainSlug: string; domainName: string } | null;

  issues: ReportIssue[]; // primary_issue + structural_root + binding_constraint

  domainBreakdown: DomainBreakdownEntry[]; // 16 entries

  valueAtStake: ValueAtStakeSpec | null; // null when 4-number gate skipped

  quickWin: {
    domainSlug: string;
    domainName: string;
    actionText: string;
  } | null;

  lockedPlan: { titles: string[] };

  ctas: ReportCta[];

  capacityMode: CapacityMode;

  confidenceNote: { level: DiagnosisConfidence; instrumentFirst: boolean };

  expertView: ExpertViewSpec;
}

export interface ReportChart {
  kind: "survival" | "health-gauge" | "radar" | "funnel-leak" | "issue-family";
  data: unknown; // shape per chart kind; defined in renderer
}

export interface ReportIssue {
  role: "primary_issue" | "structural_root" | "binding_constraint";
  engineId: number;
  domainSlug: string;
  domainName: string;
  level: DomainLevel;
  mechanism: string; // diagnosticSymptoms
  rootSentence: string; // issueRootQuestions[].diagnosticIntent
  costHint: string; // qualitative bridge to value block
}

export interface DomainRootCauseEvidence {
  questionNumber?: number;
  questionText: string;
  selectedOptionText: string;
  publicReflection: string;
  evidenceSentence: string;
}

/** Public root-cause card — no internal bundle fields. */
export interface DomainRootCause {
  rootId: string;
  rootTitle: string;
  publicRootSentence: string;
  mechanism: string;
  salesImpact: string;
  evidence: DomainRootCauseEvidence[];
}

/** Full action disclosure — only populated for the quick-win domain in freemium mode. */
export interface DomainQuickWinAction {
  actionId: string;
  actionTitle: string;
  quickWinSummary: string;
  fullAction?: string;
}

export interface DomainBreakdownEntry {
  engineId: number;
  domainSlug: string;
  domainName: string;
  rawScore: number; // 0..15
  percentage: number; // 0..100
  level: DomainLevel;
  tier: VitalityTier;
  family: string; // issueFamilies key/label
  incomplete: boolean;
  expanded: boolean; // weak → true, healthy → false
  symptoms: string; // section 2
  evidence: DomainEvidence[]; // section 3
  interpretation: string; // section 4 (domain score band)
  qualitativeCost: string; // section 5
  fixLock: {
    // section 6
    locked: boolean; // false only for quickWin domain
    label: string;
    destination: "consultation" | "ai-purchase";
  };
  /** From DomainBundle domain_levels — public headline only. */
  levelHeadline?: string;
  /** Public symptom bullets from DomainBundle — preferred over legacy symptoms string. */
  symptomsList?: string[];
  /** Triggered root causes from question_root_rules — public fields only. */
  rootCauses?: DomainRootCause[];
  /** Teaser for locked corrective action — non-quick-win domains only. */
  lockedActionTeaser?: string;
  /** Full quick-win action — quick-win domain only in freemium mode. */
  quickWinAction?: DomainQuickWinAction;
}

export interface DomainEvidence {
  questionNumber: number;
  questionText: string;
  selectedScore: 0 | 1 | 2 | 3;
  selectedOptionText: string; // user's mirrored answer
  selectedInterpretation: string; // optionInterpretations[score]
  rootSentence: string; // diagnosticIntent
}

export interface ReportCta {
  moment: "urgency" | "trust";
  headline: string;
  destination: "consultation" | "ai-purchase"; // derived from capacityMode
  personalization: {
    bindingConstraint?: string;
    structuralRoots: string[];
  };
}

export interface ExpertViewSpec {
  leadScore: "hot" | "warm" | "cold";
  suggestedOffer: string;
  appetizerActions: Array<{
    domainSlug: string;
    domainName: string;
    actionText: string;
  }>;
  disclosureGuide: string;
}
