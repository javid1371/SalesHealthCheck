import type { StructuredReport } from "@/types/report";

const SURVIVAL_LABELS: Record<
  NonNullable<StructuredReport["diagnosisSummary"]>["survivalStatus"],
  string
> = {
  RED: "بحرانی — قیف در خطر",
  AMBER: "هشدار — بقای قیف شکننده",
  GREEN: "بقای قیف پایدار",
};

interface DiagnosisSummaryPanelProps {
  summary: NonNullable<StructuredReport["diagnosisSummary"]>;
}

export function DiagnosisSummaryPanel({ summary }: DiagnosisSummaryPanelProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-amber-800">تشخیص v2</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">
            {SURVIVAL_LABELS[summary.survivalStatus]}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            سلامت درآمدی: {summary.healthWeighted}% · سلامت کلی (نمایشی):{" "}
            {summary.healthFlat}%
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700">
          اطمینان:{" "}
          {summary.confidence === "low"
            ? "پایین"
            : summary.confidence === "medium"
              ? "متوسط"
              : "بالا"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {summary.primaryIssue && (
          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-medium text-emerald-700">عارضه اصلی</p>
            <p className="mt-2 font-semibold text-zinc-900">
              {summary.primaryIssue.domainName}
            </p>
          </div>
        )}
        {summary.quickWin && (
          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-medium text-emerald-700">سریع‌ترین برد</p>
            <p className="mt-2 font-semibold text-zinc-900">
              {summary.quickWin.domainName}
            </p>
          </div>
        )}
        {summary.bindingConstraint && (
          <div className="rounded-xl bg-white p-4">
            <p className="text-xs font-medium text-emerald-700">گلوگاه جریان</p>
            <p className="mt-2 font-semibold text-zinc-900">
              {summary.bindingConstraint.domainName}
            </p>
          </div>
        )}
      </div>

      {summary.structuralRoots.length > 0 && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <p className="text-xs font-medium text-emerald-700">ریشه‌های ساختاری</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {summary.structuralRoots.map((root) => (
              <li key={root.engineId}>{root.domainName}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.issueRootQuestions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-zinc-900">ریشه‌های سطح سؤال</p>
          {summary.issueRootQuestions.slice(0, 4).map((question) => (
            <p
              key={`${question.domainSlug}-${question.questionNumber}-${question.role}`}
              className="rounded-lg bg-white px-4 py-3 text-sm leading-6 text-zinc-700"
            >
              {question.diagnosticIntent}
            </p>
          ))}
        </div>
      )}

      {summary.instrumentFirst && (
        <p className="mt-4 text-sm leading-6 text-amber-900">
          پیشنهاد موازی: ساخت داشبورد ساده اندازه‌گیری فروش در هفته اول.
        </p>
      )}
    </section>
  );
}
