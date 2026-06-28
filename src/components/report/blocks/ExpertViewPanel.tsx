import type { ExpertViewSpec } from "@/types/report-spec";
import { LEAD_SCORE_LABELS } from "@/lib/report-ui";

interface ExpertViewPanelProps {
  expertView: ExpertViewSpec;
  businessName?: string | null;
}

export function ExpertViewPanel({
  expertView,
  businessName,
}: ExpertViewPanelProps) {
  return (
    <div className="space-y-6">
      {businessName && (
        <p className="text-sm text-zinc-500">کسب‌وکار: {businessName}</p>
      )}

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
        <p className="text-sm font-medium text-indigo-800">امتیاز سرنخ</p>
        <p className="mt-2 text-2xl font-bold text-zinc-900">
          {LEAD_SCORE_LABELS[expertView.leadScore]}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">پیشنهاد فروش</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-700">
          {expertView.suggestedOffer}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          اقدامات پیش‌غذا
        </h2>
        <ul className="mt-4 space-y-3">
          {expertView.appetizerActions.map((action) => (
            <li
              key={action.domainSlug}
              className="rounded-xl border border-zinc-100 p-4"
            >
              <p className="font-medium text-zinc-900">{action.domainName}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {action.actionText}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">راهنمای افشا</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-700">
          {expertView.disclosureGuide}
        </p>
      </section>
    </div>
  );
}
