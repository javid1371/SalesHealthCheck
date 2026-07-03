"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiClientError } from "@/lib/api-client";
import {
  addConsultationNoteRequest,
  updateConsultationLeadRequest,
} from "@/lib/expert-client";
import type { LeadStatus } from "@prisma/client";

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: "new", label: "جدید" },
  { value: "contacted", label: "تماس گرفته‌شده" },
  { value: "meeting_scheduled", label: "جلسه تنظیم‌شده" },
  { value: "closed_won", label: "بسته — موفق" },
  { value: "closed_lost", label: "بسته — ناموفق" },
  { value: "unreachable", label: "در دسترس نیست" },
];

interface AssigneeOption {
  id: string;
  name: string;
}

interface LeadDetailClientProps {
  leadId: string;
  initialStatus: LeadStatus;
  initialAssignedToId: string | null;
  initialNextFollowUpAtIso: string | null;
  isAdmin: boolean;
  assigneeOptions: AssigneeOption[];
}

export function LeadDetailClient({
  leadId,
  initialStatus,
  initialAssignedToId,
  initialNextFollowUpAtIso,
  isAdmin,
  assigneeOptions,
}: LeadDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [assignedToId, setAssignedToId] = useState(
    initialAssignedToId ?? "",
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    initialNextFollowUpAtIso ?? "",
  );
  const [noteBody, setNoteBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleUpdateLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: {
        status?: LeadStatus;
        assignedToId?: string | null;
        nextFollowUpAt?: string | null;
      } = { status };

      if (isAdmin) {
        payload.assignedToId = assignedToId || null;
      }

      payload.nextFollowUpAt = nextFollowUpAt
        ? new Date(nextFollowUpAt).toISOString()
        : null;

      await updateConsultationLeadRequest(leadId, payload);
      setSuccess("تغییرات ذخیره شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در ذخیره تغییرات.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteBody.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await addConsultationNoteRequest(leadId, noteBody.trim());
      setNoteBody("");
      setSuccess("یادداشت ثبت شد.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "خطا در ثبت یادداشت.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          پیگیری لید
        </h2>
        <form onSubmit={handleUpdateLead} className="grid gap-4 sm:grid-cols-2">
          <FieldLabel label="وضعیت" htmlFor="lead-status">
            <Select
              id="lead-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as LeadStatus)
              }
              disabled={loading}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          {isAdmin ? (
            <FieldLabel label="تخصیص به کارشناس" htmlFor="lead-assignee">
              <Select
                id="lead-assignee"
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                disabled={loading}
              >
                <option value="">بدون تخصیص</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          ) : null}

          <FieldLabel label="پیگیری بعدی" htmlFor="lead-follow-up">
            <Input
              id="lead-follow-up"
              type="date"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
              disabled={loading}
            />
          </FieldLabel>

          <div className="flex items-end sm:col-span-2">
            <Button type="submit" loading={loading} loadingLabel="در حال ذخیره…">
              ذخیره تغییرات
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          افزودن یادداشت
        </h2>
        <form onSubmit={handleAddNote} className="space-y-4">
          <FieldLabel label="متن یادداشت" htmlFor="lead-note">
            <textarea
              id="lead-note"
              rows={3}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              disabled={loading}
            />
          </FieldLabel>
          <Button
            type="submit"
            variant="secondary"
            loading={loading}
            loadingLabel="در حال ثبت…"
            disabled={!noteBody.trim()}
          >
            ثبت یادداشت
          </Button>
        </form>
      </Card>

      {error ? <ErrorMessage message={error} /> : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
