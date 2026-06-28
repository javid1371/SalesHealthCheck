import {
  confidenceHonestyNote,
  getSurvivalBannerContent,
  healthyDomainSummaryLine,
  incompleteDomainLabel,
  lockedPlanTeaserBody,
  quickWinTeaserSuffix,
  shouldShowConfidenceNote,
} from "@/config/model-v1/report-content/tone-templates";
import { getCtaButtonLabel } from "@/config/model-v1/report-content/cta-templates";
import type {
  CapacityMode,
  ReportChart,
  ReportSpec,
  ToneMode,
} from "@/types/report-spec";

export type RenderMedium = "app" | "print";

export interface RenderReportOptions {
  medium?: RenderMedium;
}

export interface ReportPresentationFlags {
  expandAllDomains: boolean;
  hideInteractive: boolean;
  showPageBreakHints: boolean;
}

export type ReportBlockId =
  | "survival-banner"
  | "health-charts"
  | "issues"
  | "quick-win-teaser"
  | "domain-breakdown"
  | "value-at-stake"
  | "quick-win-full"
  | "locked-plan"
  | "confidence-cta";

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

export interface QuickWinTeaserViewModel {
  domainSlug: string;
  domainName: string;
  suffix: string;
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
  evidence: ReportSpec["domainBreakdown"][0]["evidence"];
  interpretation: string;
  qualitativeCost: string;
  fixLock: ReportSpec["domainBreakdown"][0]["fixLock"] & {
    buttonLabel: string;
  };
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
  moment: ReportSpec["ctas"][0]["moment"];
  headline: string;
  destination: ReportSpec["ctas"][0]["destination"];
  buttonLabel: string;
  personalization: ReportSpec["ctas"][0]["personalization"];
}

export interface ReportViewModel {
  medium: RenderMedium;
  presentation: ReportPresentationFlags;
  capacityMode: CapacityMode;
  blockOrder: ReportBlockId[];
  survivalBanner: SurvivalBannerViewModel;
  healthGauge: HealthGaugeViewModel;
  charts: ChartViewModel[];
  issues: ReportSpec["issues"];
  quickWinTeaser: QuickWinTeaserViewModel | null;
  domainBreakdown: DomainBreakdownViewModel[];
  valueAtStake: ValueAtStakeViewModel | null;
  quickWin: ReportSpec["quickWin"];
  lockedPlan: LockedPlanViewModel;
  confidenceNote: ConfidenceNoteViewModel;
  ctas: CtaViewModel[];
  expertView: ReportSpec["expertView"];
}

const CHART_TITLES: Record<ReportChart["kind"], string> = {
  survival: "وضعیت بقا",
  "health-gauge": "سلامت کلی قیف",
  radar: "نقشه ۱۶ دامنه",
  "funnel-leak": "نشت قیف",
  "issue-family": "خانواده‌های مسئله",
};

function buildBlockOrder(spec: ReportSpec): ReportBlockId[] {
  const order: ReportBlockId[] = [
    "survival-banner",
    "health-charts",
    "issues",
  ];

  if (spec.quickWinTeaser) {
    order.push("quick-win-teaser");
  }

  order.push("domain-breakdown");

  if (spec.valueAtStake) {
    order.push("value-at-stake");
  }

  if (spec.quickWin) {
    order.push("quick-win-full");
  }

  if (spec.lockedPlan.titles.length > 0) {
    order.push("locked-plan");
  }

  order.push("confidence-cta");

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

  return entry.symptoms;
}

/**
 * Pure Renderer: ReportSpec → view-model for UI (and future PDF).
 * No selection logic — only sentence-building and presentation shaping.
 */
function presentationFlagsForMedium(medium: RenderMedium): ReportPresentationFlags {
  if (medium === "print") {
    return {
      expandAllDomains: true,
      hideInteractive: true,
      showPageBreakHints: true,
    };
  }

  return {
    expandAllDomains: false,
    hideInteractive: false,
    showPageBreakHints: false,
  };
}

export function renderReport(
  spec: ReportSpec,
  options?: RenderReportOptions,
): ReportViewModel {
  const medium = options?.medium ?? "app";
  const presentation = presentationFlagsForMedium(medium);
  const bannerContent = getSurvivalBannerContent(spec.survivalBanner.status);

  return {
    medium,
    presentation,
    capacityMode: spec.capacityMode,
    blockOrder: buildBlockOrder(spec),
    survivalBanner: {
      status: spec.survivalBanner.status,
      tone: spec.survivalBanner.tone,
      message: bannerContent.message,
    },
    healthGauge: {
      percentage: spec.healthDisplay,
      label: "سلامت وزن‌دار قیف",
      survivalStatus: spec.survivalBanner.status,
    },
    charts: spec.charts.map((chart) => ({
      kind: chart.kind,
      title: CHART_TITLES[chart.kind],
      data: chart.data,
    })),
    issues: spec.issues,
    quickWinTeaser: spec.quickWinTeaser
      ? {
          ...spec.quickWinTeaser,
          suffix: quickWinTeaserSuffix,
        }
      : null,
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
    quickWin: spec.quickWin,
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
    ctas: spec.ctas.map((cta) => ({
      moment: cta.moment,
      headline: cta.headline,
      destination: cta.destination,
      buttonLabel: getCtaButtonLabel(spec.capacityMode),
      personalization: cta.personalization,
    })),
    expertView: spec.expertView,
  };
}
