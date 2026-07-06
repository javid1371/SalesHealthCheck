import type { LeadActivityType, LeadStatus } from "@prisma/client";

export const LEAD_ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  created: "ایجاد لید",
  status_change: "تغییر وضعیت",
  assignment_change: "تغییر تخصیص",
  note_added: "یادداشت",
  probability_override: "بازنویسی احتمال خرید",
  follow_up_set: "تعیین پیگیری",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "تماس گرفته‌شده",
  meeting_scheduled: "جلسه تنظیم‌شده",
  closed_won: "بسته — موفق",
  closed_lost: "بسته — ناموفق",
  unreachable: "در دسترس نیست",
};

export function formatStatusChangeDetail(
  from: LeadStatus,
  to: LeadStatus,
): string {
  return `${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}`;
}

export function formatActivityDetail(
  type: LeadActivityType,
  detail: string | null,
): string | null {
  if (!detail) {
    return null;
  }

  if (type === "status_change") {
    const [from, to] = detail.split("→");
    if (from && to) {
      const fromStatus = from.trim() as LeadStatus;
      const toStatus = to.trim() as LeadStatus;
      if (STATUS_LABELS[fromStatus] && STATUS_LABELS[toStatus]) {
        return formatStatusChangeDetail(fromStatus, toStatus);
      }
    }
  }

  if (type === "created" && detail === "manual") {
    return "ثبت دستی توسط ادمین";
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

  return detail;
}
