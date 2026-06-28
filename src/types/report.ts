export interface StructuredReport {
  overallSummary: string;
  layerSummaries: Array<{
    layerSlug: string;
    layerName: string;
    summary: string;
    percentage: number;
  }>;
  bottleneckSummaries: Array<{
    rank: number;
    domainSlug: string;
    domainName: string;
    summary: string;
    salesImpact: string;
  }>;
  domainResults: Array<{
    domainSlug: string;
    domainName: string;
    percentage: number;
    healthLevel: string;
    rawScore: number;
    bandLabel?: string;
    bandDescription?: string;
  }>;
  correctiveActions: Array<{
    domainSlug: string;
    domainName: string;
    description: string;
  }>;
  /** Internal-only context for rule engine and AI — not shown in user UI */
  analysisContext?: {
    perQuestion: Array<{
      domainSlug: string;
      questionNumber: number;
      diagnosticIntent: string;
      selectedScore: number;
      selectedInterpretation: string;
    }>;
    domainInterpretations: Array<{
      domainSlug: string;
      rawScore: number;
      bandLabel: string;
      bandDescription: string;
    }>;
  };
  /** v2 diagnosis summary for display — derived from StructuredDiagnosis */
  diagnosisSummary?: {
    survivalStatus: "RED" | "AMBER" | "GREEN";
    healthWeighted: number;
    healthFlat: number;
    primaryIssue: {
      engineId: number;
      domainSlug: string;
      domainName: string;
    } | null;
    structuralRoots: Array<{
      engineId: number;
      domainSlug: string;
      domainName: string;
    }>;
    quickWin: {
      engineId: number;
      domainSlug: string;
      domainName: string;
    } | null;
    bindingConstraint: {
      engineId: number;
      domainSlug: string;
      domainName: string;
    } | null;
    confidence: "low" | "medium" | "high";
    instrumentFirst: boolean;
    issueRootQuestions: Array<{
      domainSlug: string;
      questionNumber: number;
      diagnosticIntent: string;
      role: "primary_issue" | "structural_root" | "quick_win";
    }>;
  };
  /** @deprecated Legacy reports — use correctiveActions */
  actionPlans?: {
    sevenDay: Array<{ title: string; description: string }>;
    thirtyDay: Array<{ title: string; description: string }>;
  };
}

export function toPublicStructuredReport(
  report: StructuredReport,
): Omit<StructuredReport, "analysisContext"> {
  const { analysisContext: _analysisContext, ...publicReport } = report;
  return publicReport;
}
