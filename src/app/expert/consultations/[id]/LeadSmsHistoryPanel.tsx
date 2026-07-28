import { Card } from "@/components/ui/Card";
import type { ConsultationLeadSmsHistory } from "@/modules/consultation/consultation.types";

interface LeadSmsHistoryPanelProps {
  history: ConsultationLeadSmsHistory;
}

/** Active funnel enrollments only — message history lives in the lead timeline. */
export function LeadSmsHistoryPanel({ history }: LeadSmsHistoryPanelProps) {
  const { activeEnrollments } = history;

  if (activeEnrollments.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="lead-sms-enrollments-heading">
      <h3
        id="lead-sms-enrollments-heading"
        className="mb-4 text-base font-semibold text-zinc-900"
      >
        ثبت‌نام فعال قیف پیامک
      </h3>

      <ul className="space-y-2">
        {activeEnrollments.map((enrollment) => (
          <li key={enrollment.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                    {enrollment.statusLabel}
                  </span>
                  <span className="font-medium text-zinc-900">
                    {enrollment.sequenceLabel}
                  </span>
                  {enrollment.currentStep ? (
                    <span className="text-zinc-600" dir="ltr">
                      {enrollment.currentStep}
                    </span>
                  ) : null}
                </div>
                <span className="text-zinc-500">
                  ارسال‌شده: {enrollment.messagesSentCount}
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
