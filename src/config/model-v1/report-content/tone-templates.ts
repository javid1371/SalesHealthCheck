import type { ToneMode } from "@/types/report-spec";
import type {
  DiagnosisConfidence,
  SurvivalStatus,
} from "@/types/structured-diagnosis";

export interface SurvivalBannerContent {
  message: string;
  tone: ToneMode;
}

export const survivalBannerTemplates: Record<
  SurvivalStatus,
  SurvivalBannerContent
> = {
  RED: {
    message: "قیف فروش شما در وضعیت بحرانی است.",
    tone: "urgent",
  },
  AMBER: {
    message: "قیف شما در معرض خطر است.",
    tone: "serious",
  },
  GREEN: {
    message: "قیف شما پایه سالمی دارد.",
    tone: "optimization",
  },
};

export const confidenceHonestyNote =
  "این تحلیل بر اساس پاسخ‌های شماست. برای دقت بیشتر، اندازه‌گیری منظم فروش را در اولویت بگذارید.";

export const quickWinTeaserSuffix =
  "یک اقدام ساده وجود دارد که می‌توانید از همین هفته شروع کنید — جزئیات در گزارش کامل.";

export const lockedPlanTeaserBody =
  "نقشه اقدام ۳۰ روزه اختصاصی در جلسه مشاوره برای شما تهیه می‌شود.";

export const valueStakeTeaserBody =
  "با وارد کردن چند عدد ساده کسب‌وکار، می‌توانید برآورد ریالی پتانسیل بهبود را در گزارش کامل ببینید.";

export const healthyDomainSummaryLine =
  "این دامنه در وضعیت قابل قبول است و نیاز فوری به مداخله ندارد.";

export const incompleteDomainLabel = "داده ناکافی";

export const quickWinFixLockLabel =
  "راهکار این حوزه در بخش «اولین قدم پیشنهادی» باز شده است.";

export const lockedFixLabel =
  "راهکار کامل این حوزه در جلسه مشاوره ارائه می‌شود.";

export const selectedScoreFallbackLabel = (score: number, max = 3): string =>
  `پاسخ شما: ${score} از ${max}`;

export function resolveToneMode(
  survivalStatus: SurvivalStatus,
  confidence: DiagnosisConfidence,
): ToneMode {
  if (confidence === "low") {
    return "honesty";
  }

  return survivalBannerTemplates[survivalStatus].tone;
}

export function getSurvivalBannerContent(
  survivalStatus: SurvivalStatus,
): SurvivalBannerContent {
  return survivalBannerTemplates[survivalStatus];
}

export function shouldShowConfidenceNote(
  confidence: DiagnosisConfidence,
  instrumentFirst: boolean,
): boolean {
  return confidence === "low" || instrumentFirst;
}
