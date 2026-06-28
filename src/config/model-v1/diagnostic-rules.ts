import type { DiagnosisSeverity } from "@/types/diagnosis";
import { domainsV1 } from "./domains";
import { domainReportConfigV1 } from "./question-analysis-config";
import { firstSentence } from "./question-bank/parse-score-bands";

export type BottleneckDiagnosisRule = {
  key: string;
  title: string;
  description: string;
  severity: DiagnosisSeverity;
};

export type LayerDiagnosisRule = {
  key: string;
  title: string;
  description: string;
  severity: DiagnosisSeverity;
};

const domainNameBySlug = new Map(domainsV1.map((domain) => [domain.slug, domain.name]));

const bottleneckDiagnoses = Object.fromEntries(
  domainReportConfigV1.map((config) => [
    config.domainSlug,
    {
      key: `weak-${config.domainSlug}`,
      title: `ضعف در ${domainNameBySlug.get(config.domainSlug) ?? config.domainSlug}`,
      description: firstSentence(config.diagnosticSymptoms),
      severity: "high" as DiagnosisSeverity,
    },
  ]),
) as Record<string, BottleneckDiagnosisRule>;

export const diagnosticRulesV1 = {
  bottleneckDiagnoses,

  layerDiagnoses: {
    "market-message-offer": {
      key: "layer-weak-market-message-offer",
      title: "لایه بازار، پیام و پیشنهاد نیاز به توجه دارد",
      description:
        "این لایه با {percentage}٪ امتیاز، پایه ورود به بازار را ضعیف کرده و روی کل مسیر فروش اثر می‌گذارد.",
      severity: "high",
    },
    "lead-management": {
      key: "layer-weak-lead-management",
      title: "لایه لید و مدیریت سرنخ نیاز به توجه دارد",
      description:
        "این لایه با {percentage}٪ امتیاز، جریان لیدهای باکیفیت را مختل می‌کند.",
      severity: "medium",
    },
    "sales-conversation": {
      key: "layer-weak-sales-conversation",
      title: "لایه مکالمه فروش نیاز به توجه دارد",
      description:
        "این لایه با {percentage}٪ امتیاز، توانایی تبدیل لید به مشتری را محدود می‌کند.",
      severity: "high",
    },
    "relationship-optimization": {
      key: "layer-weak-relationship-optimization",
      title: "لایه رابطه و بهینه‌سازی نیاز به توجه دارد",
      description:
        "این لایه با {percentage}٪ امتیاز، رشد پایدار و تکرار خرید را کند می‌کند.",
      severity: "medium",
    },
  } satisfies Record<string, LayerDiagnosisRule>,
} as const;

export type DiagnosticRulesV1 = typeof diagnosticRulesV1;
