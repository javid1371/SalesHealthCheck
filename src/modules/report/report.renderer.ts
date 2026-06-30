import {
  confidenceHonestyNote,
  getSurvivalBannerContent,
  healthyDomainSummaryLine,
  incompleteDomainLabel,
  lockedPlanTeaserBody,
  quickWinTeaserSuffix,
  shouldShowConfidenceNote,
} from "@/config/model-v1/report-content/tone-templates";
import {
  ctaAfterValueCopy,
  ctaScoreCopy,
  ctaTopCopy,
  getCtaButtonLabel,
} from "@/config/model-v1/report-content/cta-templates";
import type {
  CapacityMode,
  ReportChart,
  ReportCta,
  ReportSpec,
  ToneMode,
} from "@/types/report-spec";

export type RenderMedium = "app" | "print";
export type ReportVariant = "summary" | "full";

export interface RenderReportOptions {
  medium?: RenderMedium;
  variant?: ReportVariant;
}

export interface ReportPresentationFlags {
  expandAllDomains: boolean;
  hideInteractive: boolean;
  showPageBreakHints: boolean;
  compactIssues: boolean;
}

export type ReportBlockId =
  | "survival-banner"
  | "health-gauge"
  | "health-charts"
  | "cta-top"
  | "cta-score"
  | "issues"
  | "quick-win"
  | "metrics-gate"
  | "value-at-stake"
  | "value-stake-teaser"
  | "domain-breakdown"
  | "locked-plan"
  | "confidence-note"
  | "cta"
  | "cta-value"
  | "summary-actions";

export interface SurvivalBannerViewModel {
  status: ReportSpec["survivalBanner"]["status"];
  tone: ToneMode;
  message: string;
}

export interface HealthGaugeViewModel {
  percentage: number;
  label: string;
  survivalStatus: ReportSpec["survivalBanner"]["status"];
}

export interface ChartViewModel {
  kind: ReportChart["kind"];
  title: string;
  data: ReportChart["data"];
}

export interface QuickWinViewModel {
  domainSlug: string;
  domainName: string;
  actionText: string | null;
  teaserSuffix: string;
  actionTitle?: string;
  quickWinSummary?: string;
  fullAction?: string;
}

export interface DomainBreakdownViewModel {
  engineId: number;
  domainSlug: string;
  domainName: string;
  rawScore: number;
  percentage: number;
  level: string;
  tier: string;
  family: string;
  incomplete: boolean;
  expanded: boolean;
  collapsedSummary: string;
  symptoms: string;
  symptomsList?: string[];
  evidence: ReportSpec["domainBreakdown"][0]["evidence"];
  interpretation: string;
  qualitativeCost: string;
  fixLock: ReportSpec["domainBreakdown"][0]["fixLock"] & {
    buttonLabel: string;
  };
  levelHeadline?: ReportSpec["domainBreakdown"][0]["levelHeadline"];
  rootCauses?: ReportSpec["domainBreakdown"][0]["rootCauses"];
  lockedActionTeaser?: ReportSpec["domainBreakdown"][0]["lockedActionTeaser"];
  quickWinAction?: ReportSpec["domainBreakdown"][0]["quickWinAction"];
}

export interface ValueAtStakeViewModel {
  visible: boolean;
  spec: NonNullable<ReportSpec["valueAtStake"]>;
}

export interface LockedPlanViewModel {
  body: string;
  titles: string[];
}

export interface ConfidenceNoteViewModel {
  visible: boolean;
  message: string;
  level: ReportSpec["confidenceNote"]["level"];
  instrumentFirst: boolean;
}

export interface CtaViewModel {
  moment: ReportCta["moment"];
  headline: string;
  destination: ReportCta["destination"];
  buttonLabel: string;
  personalization: ReportCta["personalization"];
}

export type CtaPlacementId = "top" | "score" | "final" | "afterValue";

export interface CtaPlacementViewModel {
  id: CtaPlacementId;
  headline: string;
  buttonLabel: string;
  variant: "inline" | "prominent";
}

export interface ReportViewModel {
  medium: RenderMedium;
  variant: ReportVariant;
  presentation: ReportPresentationFlags;
  capacityMode: CapacityMode;
  blockOrder: ReportBlockId[];
  survivalBanner: SurvivalBannerViewModel;
  healthGauge: HealthGaugeViewModel;
  charts: ChartViewModel[];
  issues: ReportSpec["issues"];
  quickWin: QuickWinViewModel | null;
  domainBreakdown: DomainBreakdownViewModel[];
  valueAtStake: ValueAtStakeViewModel | null;
  showMetricsGate: boolean;
  lockedPlan: LockedPlanViewModel;
  confidenceNote: ConfidenceNoteViewModel;
  ctas: CtaViewModel[];
  ctaPlacements: CtaPlacementViewModel[];
  expertView: ReportSpec["expertView"];
}

const CHART_TITLES: Record<ReportChart["kind"], string> = {
  survival: "وضعیت بقا",
  "health-gauge": "سلامت کلی قیف",
  radar: "نقشه ۱۶ دامنه",
  "funnel-leak": "نشت قیف",
  "issue-family": "خانواده‌های مسئله",
};

const HEALTH_LABEL = "سلامت فروش";

function bundleQuickWinFields(
  spec: ReportSpec,
  domainSlug: string,
): Pick<QuickWinViewModel, "actionTitle" | "quickWinSummary" | "fullAction"> {
  const bundleAction = spec.domainBreakdown.find(
    (entry) => entry.domainSlug === domainSlug,
  )?.quickWinAction;

  if (!bundleAction) {
    return {};
  }

  const fields: Pick<
    QuickWinViewModel,
    "actionTitle" | "quickWinSummary" | "fullAction"
  > = {};

  const actionTitle = bundleAction.actionTitle.trim();
  if (actionTitle) {
    fields.actionTitle = actionTitle;
  }

  const quickWinSummary = bundleAction.quickWinSummary.trim();
  if (quickWinSummary) {
    fields.quickWinSummary = quickWinSummary;
  }

  const fullAction = bundleAction.fullAction?.trim();
  if (fullAction) {
    fields.fullAction = fullAction;
  }

  return fields;
}

function buildQuickWinViewModel(spec: ReportSpec): QuickWinViewModel | null {
  if (spec.quickWin) {
    const bundleFields = bundleQuickWinFields(spec, spec.quickWin.domainSlug);

    return {
      domainSlug: spec.quickWin.domainSlug,
      domainName: spec.quickWin.domainName,
      actionText:
        bundleFields.quickWinSummary ?? spec.quickWin.actionText,
      teaserSuffix: quickWinTeaserSuffix,
      ...bundleFields,
    };
  }

  if (spec.quickWinTeaser) {
    return {
      domainSlug: spec.quickWinTeaser.domainSlug,
      domainName: spec.quickWinTeaser.domainName,
      actionText: null,
      teaserSuffix: quickWinTeaserSuffix,
      ...bundleQuickWinFields(spec, spec.quickWinTeaser.domainSlug),
    };
  }

  return null;
}

function buildBlockOrder(
  spec: ReportSpec,
  variant: ReportVariant,
): ReportBlockId[] {
  if (variant === "summary") {
    const order: ReportBlockId[] = [
      "survival-banner",
      "health-gauge",
      "issues",
    ];

    if (buildQuickWinViewModel(spec)) {
      order.push("quick-win");
    }

    order.push("summary-actions");

    return order;
  }

  const order: ReportBlockId[] = [
    "survival-banner",
    "cta-top",
    "health-charts",
    "cta-score",
    "issues",
  ];

  if (buildQuickWinViewModel(spec)) {
    order.push("quick-win");
  }

  order.push("domain-breakdown");

  if (spec.lockedPlan.titles.length > 0) {
    order.push("locked-plan");
  }

  if (
    shouldShowConfidenceNote(
      spec.confidenceNote.level,
      spec.confidenceNote.instrumentFirst,
    )
  ) {
    order.push("confidence-note");
  }

  order.push("cta");

  if (spec.valueAtStake) {
    order.push("value-at-stake", "cta-value");
  } else {
    order.push("metrics-gate");
  }

  return order;
}

function collapsedSummaryForDomain(
  entry: ReportSpec["domainBreakdown"][0],
): string {
  if (entry.incomplete) {
    return incompleteDomainLabel;
  }

  if (entry.level === "healthy" || entry.level === "advanced") {
    return healthyDomainSummaryLine;
  }

  const firstSymptom = entry.symptomsList?.[0]?.trim();
  if (firstSymptom) {
    return firstSymptom;
  }

  return entry.symptoms;
}

function selectPrimaryCta(ctas: ReportCta[]): ReportCta | null {
  const consultation = ctas.filter((cta) => cta.destination === "consultation");
  if (consultation.length === 0) {
    return null;
  }

  return (
    consultation.find((cta) => cta.moment === "trust") ?? consultation[0]
  );
}

function selectUrgencyCta(ctas: ReportCta[]): ReportCta | null {
  return ctas.find((cta) => cta.moment === "urgency") ?? null;
}

function buildCtaPlacements(
  spec: ReportSpec,
  variant: ReportVariant,
): CtaPlacementViewModel[] {
  const buttonLabel = getCtaButtonLabel(spec.capacityMode);
  const urgencyCta = selectUrgencyCta(spec.ctas);
  const trustCta = selectPrimaryCta(spec.ctas);
  const placements: CtaPlacementViewModel[] = [];

  placements.push({
    id: "top",
    headline: urgencyCta?.headline ?? ctaTopCopy.headline,
    buttonLabel,
    variant: "inline",
  });

  if (variant === "full") {
    placements.push({
      id: "score",
      headline: ctaScoreCopy.headline,
      buttonLabel,
      variant: "inline",
    });
  }

  if (trustCta) {
    placements.push({
      id: "final",
      headline: trustCta.headline,
      buttonLabel,
      variant: "prominent",
    });
  }

  if (spec.valueAtStake) {
    placements.push({
      id: "afterValue",
      headline: ctaAfterValueCopy.headline,
      buttonLabel,
      variant: "prominent",
    });
  }

  return placements;
}

function enrichChartData(
  chart: ReportChart,
  spec: ReportSpec,
): unknown {
  if (chart.kind !== "survival") {
    return chart.data;
  }

  const data = chart.data as {
    status: string;
    alerts: Array<{
      engineId: number;
      domainSlug: string;
      flag: string;
      pct: number;
    }>;
  };

  const nameByEngineId = new Map(
    spec.domainBreakdown.map((entry) => [entry.engineId, entry.domainName]),
  );
  const nameBySlug = new Map(
    spec.domainBreakdown.map((entry) => [entry.domainSlug, entry.domainName]),
  );

  return {
    ...data,
    alerts: data.alerts.map((alert) => ({
      ...alert,
      domainName:
        nameByEngineId.get(alert.engineId) ??
        nameBySlug.get(alert.domainSlug) ??
        alert.domainSlug,
    })),
  };
}

function presentationFlagsForOptions(
  medium: RenderMedium,
  variant: ReportVariant,
): ReportPresentationFlags {
  if (medium === "print") {
    return {
      expandAllDomains: true,
      hideInteractive: true,
      showPageBreakHints: true,
      compactIssues: false,
    };
  }

  return {
    expandAllDomains: false,
    hideInteractive: false,
    showPageBreakHints: false,
    compactIssues: variant === "summary",
  };
}

/**
 * Pure Renderer: ReportSpec → view-model for UI (and future PDF).
 * No selection logic — only sentence-building and presentation shaping.
 */
export function renderReport(
  spec: ReportSpec,
  options?: RenderReportOptions,
): ReportViewModel {
  const medium = options?.medium ?? "app";
  const variant = options?.variant ?? (medium === "print" ? "full" : "full");
  const presentation = presentationFlagsForOptions(medium, variant);
  const bannerContent = getSurvivalBannerContent(spec.survivalBanner.status);
  const primaryCta = selectPrimaryCta(spec.ctas);
  const ctaPlacements = buildCtaPlacements(spec, variant);

  return {
    medium,
    variant,
    presentation,
    capacityMode: spec.capacityMode,
    blockOrder: buildBlockOrder(spec, variant),
    survivalBanner: {
      status: spec.survivalBanner.status,
      tone: spec.survivalBanner.tone,
      message: bannerContent.message,
    },
    healthGauge: {
      percentage: spec.healthDisplay,
      label: HEALTH_LABEL,
      survivalStatus: spec.survivalBanner.status,
    },
    charts: spec.charts.map((chart) => ({
      kind: chart.kind,
      title: CHART_TITLES[chart.kind],
      data: enrichChartData(chart, spec),
    })),
    issues: spec.issues,
    quickWin: buildQuickWinViewModel(spec),
    domainBreakdown: spec.domainBreakdown.map((entry) => ({
      ...entry,
      expanded: presentation.expandAllDomains ? true : entry.expanded,
      collapsedSummary: collapsedSummaryForDomain(entry),
      fixLock: {
        ...entry.fixLock,
        buttonLabel: getCtaButtonLabel(spec.capacityMode),
      },
    })),
    valueAtStake: spec.valueAtStake
      ? { visible: true, spec: spec.valueAtStake }
      : null,
    showMetricsGate: !spec.valueAtStake,
    lockedPlan: {
      body: lockedPlanTeaserBody,
      titles: spec.lockedPlan.titles,
    },
    confidenceNote: {
      visible: shouldShowConfidenceNote(
        spec.confidenceNote.level,
        spec.confidenceNote.instrumentFirst,
      ),
      message: confidenceHonestyNote,
      level: spec.confidenceNote.level,
      instrumentFirst: spec.confidenceNote.instrumentFirst,
    },
    ctas: primaryCta
      ? [
          {
            moment: primaryCta.moment,
            headline: primaryCta.headline,
            destination: primaryCta.destination,
            buttonLabel: getCtaButtonLabel(spec.capacityMode),
            personalization: primaryCta.personalization,
          },
        ]
      : [],
    ctaPlacements,
    expertView: spec.expertView,
  };
}
