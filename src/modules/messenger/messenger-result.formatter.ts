import { getSurvivalBannerContent } from "@/config/model-v1/report-content/tone-templates";
import { healthLevelLabelFa } from "@/lib/health-level";
import { SURVIVAL_LABELS } from "@/lib/report-ui";
import type { AssessmentResultResponse } from "@/modules/assessment/assessment.types";
import type { StructuredReport } from "@/types/report";
import type { SurvivalStatus } from "@/types/structured-diagnosis";
import {
  MESSENGER_MESSAGE_MAX_LENGTH,
  splitTextForMessenger,
} from "./bot/send-long-text";

function asStructuredReport(
  result: AssessmentResultResponse,
): StructuredReport {
  return {
    overallSummary: result.report.overallSummary,
    layerSummaries: Array.isArray(result.report.layerSummaries)
      ? (result.report.layerSummaries as StructuredReport["layerSummaries"])
      : [],
    bottleneckSummaries: Array.isArray(result.report.bottleneckSummaries)
      ? (result.report.bottleneckSummaries as StructuredReport["bottleneckSummaries"])
      : [],
    domainResults: Array.isArray(result.report.domainResults)
      ? (result.report.domainResults as StructuredReport["domainResults"])
      : [],
    correctiveActions: result.report.correctiveActions ?? [],
    diagnosisSummary: result.report.diagnosisSummary,
  };
}

function resolveSurvivalStatus(
  report: StructuredReport,
): SurvivalStatus | null {
  return report.diagnosisSummary?.survivalStatus ?? null;
}

function formatSurvivalBanner(status: SurvivalStatus): string {
  const banner = getSurvivalBannerContent(status);
  return `🚦 ${SURVIVAL_LABELS[status]}\n${banner.message}`;
}

function formatDiagnoses(result: AssessmentResultResponse): string {
  if (result.diagnoses.length === 0) {
    return "";
  }

  const lines = result.diagnoses
    .slice(0, 5)
    .map((diagnosis, index) => `${index + 1}. ${diagnosis.title}`);

  return ["تشخیص‌های اصلی:", ...lines].join("\n");
}

function formatBottlenecks(report: StructuredReport): string {
  if (report.bottleneckSummaries.length === 0) {
    return "";
  }

  const lines = report.bottleneckSummaries.map(
    (item) =>
      `${item.rank}. ${item.domainName}\n${item.summary}\n${item.salesImpact ? `اثر فروش: ${item.salesImpact}` : ""}`.trim(),
  );

  return ["گلوگاه‌های اصلی:", ...lines].join("\n\n");
}

function formatCorrectiveActions(report: StructuredReport): string {
  const actions = report.correctiveActions.slice(0, 5);
  if (actions.length === 0) {
    return "";
  }

  const lines = actions.map(
    (action, index) =>
      `${index + 1}. ${action.domainName}\n${action.description}`,
  );

  return ["اقدامات اصلاحی:", ...lines].join("\n\n");
}

function formatLayerScores(result: AssessmentResultResponse): string {
  if (result.layerScores.length === 0) {
    return "";
  }

  const lines = result.layerScores.map(
    (layer) =>
      `• ${layer.name}: ${Math.round(layer.percentage)}٪ — ${healthLevelLabelFa(layer.healthLevel as Parameters<typeof healthLevelLabelFa>[0])}`,
  );

  return ["امتیاز لایه‌ها:", ...lines].join("\n");
}

function formatDomainSummary(result: AssessmentResultResponse): string {
  const domains = result.domainScores.length
    ? result.domainScores
    : result.spiderChartData.map((item) => ({
        name: item.domainName,
        percentage: item.percentage,
        healthLevel: "medium" as const,
      }));

  if (domains.length === 0) {
    return "";
  }

  const lines = domains.map(
    (domain) =>
      `• ${domain.name}: ${Math.round(domain.percentage)}٪ — ${healthLevelLabelFa(domain.healthLevel as Parameters<typeof healthLevelLabelFa>[0])}`,
  );

  return ["خلاصه دامنه‌ها:", ...lines].join("\n");
}

export function formatAssessmentResultForMessenger(
  result: AssessmentResultResponse,
): string[] {
  const report = asStructuredReport(result);
  const survivalStatus = resolveSurvivalStatus(report);
  const overallHealth = healthLevelLabelFa(
    result.overallScore.healthLevel as Parameters<typeof healthLevelLabelFa>[0],
  );

  const sections = [
    [
      "✅ گزارش ارزیابی سلامت فروش",
      survivalStatus ? formatSurvivalBanner(survivalStatus) : "",
      "",
      `امتیاز کلی: ${Math.round(result.overallScore.percentage)}٪`,
      `وضعیت: ${overallHealth}`,
      "",
      report.overallSummary,
    ]
      .filter(Boolean)
      .join("\n"),
    [formatBottlenecks(report), formatDiagnoses(result)].filter(Boolean).join("\n\n"),
    formatCorrectiveActions(report),
    formatLayerScores(result),
    formatDomainSummary(result),
  ].filter((section) => section.trim().length > 0);

  const combined = sections.join("\n\n────────────\n\n");
  return splitTextForMessenger(combined, MESSENGER_MESSAGE_MAX_LENGTH);
}
