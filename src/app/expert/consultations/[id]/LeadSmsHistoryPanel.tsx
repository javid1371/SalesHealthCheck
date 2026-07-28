import { Card } from "@/components/ui/Card";
import type { ConsultationLeadSmsHistory } from "@/modules/consultation/consultation.types";

interface LeadSmsHistoryPanelProps {
  history: ConsultationLeadSmsHistory;
}

export function LeadSmsHistoryPanel({ history }: LeadSmsHistoryPanelProps) {
  const { activeEnrollments, messages } = history;

  return (
    <section className="mt-8 mb-8">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">
        تاریخچه پیامک قیف
      </h2>

      {activeEnrollments.length > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-zinc-700">ثبت‌نام فعال</p>
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
        </div>
      ) : null}

      {messages.length === 0 ? (
        <Card className="text-center">
          <p className="text-zinc-600">پیامکی برای این لید ثبت نشده است.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700">زمان</th>
                <th className="px-4 py-3 font-medium text-zinc-700">
                  توالی / مرحله
                </th>
                <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {messages.map((message) => (
                <tr key={message.id}>
                  <td className="px-4 py-3 text-zinc-600">
                    {message.sentAt ?? message.scheduledFor}
                  </td>
                  <td className="px-4 py-3 text-zinc-800">
                    <span className="font-medium">{message.sequenceLabel}</span>
                    <span className="mx-1 text-zinc-400">/</span>
                    <span dir="ltr">{message.stepKey}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        message.status === "sent"
                          ? "bg-emerald-100 text-emerald-800"
                          : message.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : message.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {message.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
