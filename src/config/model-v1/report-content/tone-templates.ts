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
  "این تشخیص فعلاً تخمینی است چون عدد ندارید؛ ساخت داشبورد ساده اولین قدم موازی است.";

export const quickWinTeaserSuffix =
  "یک اقدام سریع هست که می‌تواند از همین فردا شروع شود — کاملش پایین‌تر.";

export const lockedPlanTeaserBody =
  "نقشه ۳۰ روزه اختصاصی شما آماده است.";

export const healthyDomainSummaryLine =
  "این دامنه در وضعیت قابل قبول است و نیاز فوری به مداخله ندارد.";

export const incompleteDomainLabel = "داده ناکافی";

export const quickWinFixLockLabel =
  "راهکار این دامنه را پایین‌تر، در برد سریع، کامل باز کرده‌ایم.";

export const lockedFixLabel = "راهکار کامل این دامنه در برنامه اختصاصی است.";

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
