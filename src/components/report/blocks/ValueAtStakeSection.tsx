import type { ValueAtStakeViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { formatToman } from "@/lib/report-ui";
import { cn } from "@/lib/utils";

interface ValueAtStakeSectionProps {
  valueAtStake: ValueAtStakeViewModel;
  medium?: RenderMedium;
}

export function ValueAtStakeSection({
  valueAtStake,
  medium = "app",
}: ValueAtStakeSectionProps) {
  const { spec } = valueAtStake;

  return (
    <section
      className={cn(
        "rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <h2 className="text-lg font-semibold text-zinc-900">ارزش در خطر</h2>
      <p className="mt-1 text-sm text-zinc-600">
        پتانسیل قابل بازیابی بر اساس اعداد شما
      </p>

      <div className="mt-6 rounded-xl bg-white p-5">
        <p className="text-sm font-medium text-amber-800">طبقه ۱ — عددی</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">
          {formatToman(spec.tier1.monthly)}
          <span className="mr-2 text-base font-normal text-zinc-500">
            / ماه
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          سالانه: {formatToman(spec.tier1.annual)} · بازه:{" "}
          {formatToman(spec.tier1.range.low)} تا{" "}
          {formatToman(spec.tier1.range.high)}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-3 text-sm">
            <p className="text-zinc-500">تبدیل</p>
            <p className="mt-1 font-semibold text-zinc-900">
              {formatToman(spec.tier1.breakdown.conversion)}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm">
            <p className="text-zinc-500">AOV</p>
            <p className="mt-1 font-semibold text-zinc-900">
              {formatToman(spec.tier1.breakdown.aov)}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm">
            <p className="text-zinc-500">تکرار</p>
            <p className="mt-1 font-semibold text-zinc-900">
              {formatToman(spec.tier1.breakdown.repeat)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white p-5">
        <p className="text-sm font-medium text-zinc-700">طبقه ۲ — کیفی</p>
        <p className="mt-2 text-sm leading-7 text-zinc-600">
          {spec.tier2.qualitative}
        </p>
      </div>

      <div className="mt-4 rounded-xl bg-white p-5">
        <p className="text-sm font-medium text-zinc-700">طبقه ۳ — مشروط</p>
        <p className="mt-2 text-sm leading-7 text-zinc-600">
          {spec.tier3.mechanism}
        </p>
        {spec.tier3.conditions.length > 0 && (
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-600">
            {spec.tier3.conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
