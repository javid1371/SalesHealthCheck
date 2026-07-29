"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateMessengerLabelsRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { MessengerLabelAdminDomain } from "@/modules/messenger/messenger-labels.repository";
import { MESSENGER_BUTTON_MAX_LENGTH } from "@/modules/messenger/messenger-labels.utils";

interface MessengerLabelsFormProps {
  domains: MessengerLabelAdminDomain[];
  modelVersionName: string | null;
}

function buildInitialDraft(
  domains: MessengerLabelAdminDomain[],
): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const domain of domains) {
    for (const question of domain.questions) {
      for (const option of question.options) {
        draft[option.optionId] = option.messengerLabel ?? "";
      }
    }
  }
  return draft;
}

export function MessengerLabelsForm({
  domains,
  modelVersionName,
}: MessengerLabelsFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => buildInitialDraft(domains));
  const [selectedDomainId, setSelectedDomainId] = useState(
    domains[0]?.domainId ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.domainId === selectedDomainId),
    [domains, selectedDomainId],
  );

  const dirtyUpdates = useMemo(() => {
    const updates: { optionId: string; messengerLabel: string | null }[] = [];
    for (const domain of domains) {
      for (const question of domain.questions) {
        for (const option of question.options) {
          const next = (draft[option.optionId] ?? "").trim();
          const prev = (option.messengerLabel ?? "").trim();
          if (next !== prev) {
            updates.push({
              optionId: option.optionId,
              messengerLabel: next.length === 0 ? null : next,
            });
          }
        }
      }
    }
    return updates;
  }, [domains, draft]);

  const overLimitCount = useMemo(() => {
    let count = 0;
    for (const value of Object.values(draft)) {
      if (value.trim().length > MESSENGER_BUTTON_MAX_LENGTH) {
        count += 1;
      }
    }
    return count;
  }, [draft]);

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (overLimitCount > 0) {
      setError(
        `${overLimitCount.toLocaleString("fa-IR")} برچسب بیش از ${MESSENGER_BUTTON_MAX_LENGTH} کاراکتر است.`,
      );
      return;
    }

    if (dirtyUpdates.length === 0) {
      setSuccess("تغییری برای ذخیره وجود ندارد.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateMessengerLabelsRequest(dirtyUpdates);
      setSuccess(
        `${result.updated.toLocaleString("fa-IR")} برچسب ذخیره شد.`,
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ذخیره برچسب‌ها با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (domains.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-zinc-600">مدل فعال یا گزینه‌ای برای ویرایش یافت نشد.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="compact">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-600">
              مدل فعال:{" "}
              <span className="font-medium text-zinc-900">
                {modelVersionName ?? "—"}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              متن کامل گزینه در بدنه پیام ربات می‌ماند؛ این فیلد فقط متن دکمه
              inline است.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-zinc-700">
              دامنه
              <select
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                className="mt-1 block min-w-[12rem] rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              >
                {domains.map((domain) => (
                  <option key={domain.domainId} value={domain.domainId}>
                    {domain.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              disabled={loading || overLimitCount > 0}
              onClick={() => void handleSave()}
            >
              {loading
                ? "در حال ذخیره…"
                : `ذخیره تغییرات (${dirtyUpdates.length.toLocaleString("fa-IR")})`}
            </Button>
          </div>
        </div>
      </Card>

      {(error || success) && (
        <div className="space-y-2">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </p>
          ) : null}
        </div>
      )}

      {selectedDomain ? (
        <div className="space-y-4">
          {selectedDomain.questions.map((question) => (
            <Card key={question.questionId} padding="compact">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                <span className="ml-2 text-zinc-400">
                  {question.displayOrder.toLocaleString("fa-IR")}.
                </span>
                {question.text}
              </h3>
              <div className="space-y-3">
                {question.options.map((option) => {
                  const value = draft[option.optionId] ?? "";
                  const length = value.trim().length;
                  const tooLong = length > MESSENGER_BUTTON_MAX_LENGTH;

                  return (
                    <div
                      key={option.optionId}
                      className="grid gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 sm:grid-cols-[4rem_1fr]"
                    >
                      <div className="text-xs text-zinc-500">
                        امتیاز {option.score.toLocaleString("fa-IR")}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-600">{option.text}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={value}
                            maxLength={MESSENGER_BUTTON_MAX_LENGTH + 8}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [option.optionId]: e.target.value,
                              }))
                            }
                            placeholder={option.resolvedLabel}
                            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                            dir="rtl"
                          />
                          <span
                            className={`text-xs tabular-nums ${
                              tooLong ? "text-red-600" : "text-zinc-500"
                            }`}
                            dir="ltr"
                          >
                            {length}/{MESSENGER_BUTTON_MAX_LENGTH}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
