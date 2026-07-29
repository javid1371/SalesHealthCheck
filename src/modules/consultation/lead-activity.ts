import type {
  CallOutcome,
  LeadActivityType,
  LeadStatus,
  LeadTransferReason,
  LostReason,
} from "@prisma/client";

export const LEAD_ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  created: "ایجاد لید",
  status_change: "تغییر وضعیت",
  assignment_change: "تغییر تخصیص",
  note_added: "یادداشت",
  probability_override: "بازنویسی احتمال خرید",
  follow_up_set: "تعیین پیگیری",
  call_logged: "ثبت تماس",
};

export const CALL_OUTCOMES: CallOutcome[] = [
  "no_answer",
  "busy",
  "connected_interested",
  "connected_not_interested",
  "wrong_number",
  "callback_requested",
];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: "بدون پاسخ",
  busy: "اشغال",
  connected_interested: "وصل — علاقه‌مند",
  connected_not_interested: "وصل — بی‌علاقه",
  wrong_number: "شماره اشتباه",
  callback_requested: "درخواست تماس مجدد",
};

/** Frequent outcomes for Kanban quick actions. */
export const QUICK_CALL_OUTCOMES: CallOutcome[] = [
  "no_answer",
  "busy",
  "connected_interested",
  "callback_requested",
];

/** Suggested lead fields after selecting a call outcome (UI defaults; overridable). */
export type AfterCallSuggestion = {
  /** Omit when status should stay unchanged. */
  status?: LeadStatus;
  /**
   * Days from today for next follow-up.
   * `null` = clear / leave empty; `undefined` = do not suggest a follow-up change.
   */
  nextFollowUpDays?: number | null;
  lostReason?: LostReason;
};

/** Per-outcome suggestions stored in `LeadSetting.call_outcome_matrix_json`. */
export type CallOutcomeMatrix = Record<CallOutcome, AfterCallSuggestion>;

/** Built-in matrix (matches historical hard-coded suggestAfterCallDefaults). */
export const DEFAULT_CALL_OUTCOME_MATRIX: CallOutcomeMatrix = {
  no_answer: { nextFollowUpDays: 1 },
  busy: { nextFollowUpDays: 1 },
  callback_requested: { status: "contacted", nextFollowUpDays: 1 },
  connected_interested: { status: "contacted", nextFollowUpDays: null },
  connected_not_interested: { status: "closed_lost" },
  wrong_number: { status: "closed_lost", lostReason: "low_quality" },
};

export function cloneDefaultCallOutcomeMatrix(): CallOutcomeMatrix {
  return {
    no_answer: { ...DEFAULT_CALL_OUTCOME_MATRIX.no_answer },
    busy: { ...DEFAULT_CALL_OUTCOME_MATRIX.busy },
    callback_requested: { ...DEFAULT_CALL_OUTCOME_MATRIX.callback_requested },
    connected_interested: { ...DEFAULT_CALL_OUTCOME_MATRIX.connected_interested },
    connected_not_interested: {
      ...DEFAULT_CALL_OUTCOME_MATRIX.connected_not_interested,
    },
    wrong_number: { ...DEFAULT_CALL_OUTCOME_MATRIX.wrong_number },
  };
}

export function suggestAfterCallDefaults(
  outcome: CallOutcome,
  matrix: CallOutcomeMatrix = DEFAULT_CALL_OUTCOME_MATRIX,
): AfterCallSuggestion {
  const entry = matrix[outcome] ?? DEFAULT_CALL_OUTCOME_MATRIX[outcome];
  return { ...entry };
}

/** Fields to send with a kanban quick-call log (no extra UI unless reason required). */
export type QuickCallLogFields =
  | { needsLostReason: true }
  | {
      needsLostReason: false;
      status?: LeadStatus;
      nextFollowUpDays?: number | null;
      lostReason?: LostReason;
      lostNote?: string | null;
    };

/**
 * Apply suggestAfterCallDefaults for kanban logQuickCall.
 * Returns needsLostReason when closed_lost has no suggested/provided reason.
 */
export function resolveQuickCallLogFields(
  outcome: CallOutcome,
  lost?: { lostReason: LostReason; lostNote?: string | null },
  matrix: CallOutcomeMatrix = DEFAULT_CALL_OUTCOME_MATRIX,
): QuickCallLogFields {
  const suggestion = suggestAfterCallDefaults(outcome, matrix);
  const lostReason = lost?.lostReason ?? suggestion.lostReason;

  if (suggestion.status === "closed_lost" && !lostReason) {
    return { needsLostReason: true };
  }

  return {
    needsLostReason: false,
    ...(suggestion.status !== undefined ? { status: suggestion.status } : {}),
    ...(suggestion.nextFollowUpDays !== undefined
      ? { nextFollowUpDays: suggestion.nextFollowUpDays }
      : {}),
    ...(suggestion.status === "closed_lost" && lostReason
      ? {
          lostReason,
          ...(lostReason === "other"
            ? { lostNote: lost?.lostNote ?? null }
            : {}),
        }
      : {}),
  };
}

export const LEAD_TRANSFER_REASONS: LeadTransferReason[] = [
  "workload",
  "leave",
  "expertise",
  "customer_request",
  "other",
];

export const LEAD_TRANSFER_REASON_LABELS: Record<LeadTransferReason, string> = {
  workload: "حجم کار",
  leave: "مرخصی",
  expertise: "تخصص",
  customer_request: "درخواست مشتری",
  other: "سایر",
};

export const TRANSFER_NOTE_MIN_LENGTH = 15;

export const LOST_REASONS: LostReason[] = [
  "price",
  "timing",
  "competitor",
  "no_response",
  "low_quality",
  "not_a_fit",
  "other",
];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: "قیمت",
  timing: "زمان‌بندی",
  competitor: "رقیب",
  no_response: "عدم پاسخ",
  low_quality: "کیفیت پایین لید",
  not_a_fit: "عدم تناسب",
  other: "سایر",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  assessment_in_progress: "در حال انجام تست",
  assessment_incomplete: "پیگیری تکمیل تست",
  assessment_completed: "تست تکمیل‌شده",
  new: "آماده تماس",
  contacted: "تماس گرفته‌شده",
  meeting_scheduled: "جلسه تنظیم‌شده",
  closed_won: "بسته — موفق",
  closed_lost: "بسته — ناموفق",
  unreachable: "در دسترس نیست",
};

export type AssignmentChangeDetail = {
  fromId: string | null;
  toId: string | null;
  fromName: string | null;
  toName: string | null;
  reason?: LeadTransferReason;
};

export function serializeAssignmentChangeDetail(
  detail: AssignmentChangeDetail,
): string {
  return JSON.stringify(detail);
}

export function parseAssignmentChangeDetail(
  detail: string,
): AssignmentChangeDetail | null {
  const trimmed = detail.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<AssignmentChangeDetail>;
    if (
      typeof parsed !== "object" ||
      parsed == null ||
      !("fromId" in parsed) ||
      !("toId" in parsed)
    ) {
      return null;
    }

    return {
      fromId: typeof parsed.fromId === "string" ? parsed.fromId : null,
      toId: typeof parsed.toId === "string" ? parsed.toId : null,
      fromName: typeof parsed.fromName === "string" ? parsed.fromName : null,
      toName: typeof parsed.toName === "string" ? parsed.toName : null,
      reason:
        typeof parsed.reason === "string" &&
        LEAD_TRANSFER_REASONS.includes(parsed.reason as LeadTransferReason)
          ? (parsed.reason as LeadTransferReason)
          : undefined,
    };
  } catch {
    return null;
  }
}

export function formatAssignmentChangeDetail(detail: string): string {
  const parsed = parseAssignmentChangeDetail(detail);
  if (parsed) {
    const fromLabel = parsed.fromName?.trim() || "بدون تخصیص";
    const toLabel = parsed.toName?.trim() || "بدون تخصیص";
    const base = `${fromLabel} → ${toLabel}`;
    if (parsed.reason) {
      return `${base} | ${LEAD_TRANSFER_REASON_LABELS[parsed.reason]}`;
    }
    return base;
  }

  if (detail === "unassigned") {
    return "لغو تخصیص";
  }

  return detail;
}

export function formatTransferNoteBody(
  reason: LeadTransferReason,
  note: string,
): string {
  return `انتقال: ${LEAD_TRANSFER_REASON_LABELS[reason]} — ${note.trim()}`;
}

export function formatStatusChangeDetail(
  from: LeadStatus,
  to: LeadStatus,
): string {
  return `${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}`;
}

/**
 * Journey-oriented label for known status transitions (timeline badge).
 * Returns null when the generic "تغییر وضعیت" label should be used.
 */
export function formatStatusChangeJourneyLabel(
  from: LeadStatus,
  to: LeadStatus,
): string | null {
  if (
    from === "assessment_in_progress" &&
    to === "assessment_completed"
  ) {
    return "تست تکمیل شد";
  }
  if (to === "assessment_incomplete") {
    return "تست نیمه‌کاره شد";
  }
  if (to === "new") {
    return "درخواست مشاوره ثبت شد";
  }
  return null;
}

export function parseStatusChangeDetail(
  detail: string,
): { from: LeadStatus; to: LeadStatus } | null {
  const [fromRaw, toRaw] = detail.split("→");
  if (!fromRaw || !toRaw) {
    return null;
  }
  const from = fromRaw.trim() as LeadStatus;
  const to = toRaw.trim() as LeadStatus;
  if (!STATUS_LABELS[from] || !STATUS_LABELS[to]) {
    return null;
  }
  return { from, to };
}

export function resolveActivityTimelineLabel(
  type: LeadActivityType,
  detail: string | null,
): string {
  if (type === "status_change" && detail) {
    const parsed = parseStatusChangeDetail(detail);
    if (parsed) {
      const journey = formatStatusChangeJourneyLabel(parsed.from, parsed.to);
      if (journey) {
        return journey;
      }
    }
  }
  return LEAD_ACTIVITY_LABELS[type];
}

export function formatActivityDetail(
  type: LeadActivityType,
  detail: string | null,
): string | null {
  if (!detail) {
    return null;
  }

  if (type === "status_change") {
    const parsed = parseStatusChangeDetail(detail);
    if (parsed) {
      return formatStatusChangeDetail(parsed.from, parsed.to);
    }
  }

  if (type === "assignment_change") {
    return formatAssignmentChangeDetail(detail);
  }

  if (type === "created" && detail === "manual") {
    return "ثبت دستی توسط ادمین";
  }

  if (type === "created" && detail === "assessment_start") {
    return "شروع تست / ایجاد لید سیستمی";
  }

  if (type === "probability_override") {
    if (detail === "cleared") {
      return "حذف بازنویسی — بازگشت به مقدار سیستمی";
    }
    return `${detail}٪`;
  }

  if (type === "follow_up_set") {
    if (detail === "cleared") {
      return "حذف تاریخ پیگیری";
    }
    const date = new Date(detail);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(
        date,
      );
    }
  }

  if (type === "call_logged") {
    return formatCallLoggedDetail(detail);
  }

  return detail;
}

export function formatCallLoggedDetail(detail: string): string {
  const trimmed = detail.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        outcome?: string;
        note?: string | null;
      };
      if (
        typeof parsed.outcome === "string" &&
        CALL_OUTCOMES.includes(parsed.outcome as CallOutcome)
      ) {
        const label = CALL_OUTCOME_LABELS[parsed.outcome as CallOutcome];
        const note =
          typeof parsed.note === "string" ? parsed.note.trim() : "";
        return note ? `${label} — ${note}` : label;
      }
    } catch {
      // fall through to plain outcome / raw detail
    }
  }

  if (CALL_OUTCOMES.includes(trimmed as CallOutcome)) {
    return CALL_OUTCOME_LABELS[trimmed as CallOutcome];
  }

  return detail;
}

export function serializeCallLoggedDetail(
  outcome: CallOutcome,
  note?: string | null,
): string {
  const trimmedNote = note?.trim();
  if (trimmedNote) {
    return JSON.stringify({ outcome, note: trimmedNote });
  }
  return outcome;
}
