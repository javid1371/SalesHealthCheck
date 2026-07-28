"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import {
  CALL_OUTCOME_LABELS,
  CALL_OUTCOMES,
} from "@/modules/consultation/lead-activity";

const STATUS_OPTIONS = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "assessment_in_progress", label: "در حال انجام تست" },
  { value: "assessment_incomplete", label: "پیگیری تکمیل تست" },
  { value: "assessment_completed", label: "تست تکمیل‌شده" },
  { value: "new", label: "آماده تماس" },
  { value: "contacted", label: "تماس گرفته‌شده" },
  { value: "meeting_scheduled", label: "جلسه تنظیم‌شده" },
  { value: "closed_won", label: "بسته — موفق" },
  { value: "closed_lost", label: "بسته — ناموفق" },
  { value: "unreachable", label: "در دسترس نیست" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "همه منابع" },
  { value: "direct", label: "درخواست مستقیم" },
  { value: "system", label: "تشخیص سیستم" },
  { value: "messenger", label: "پیام‌رسان" },
];

const PROBABILITY_BAND_OPTIONS = [
  { value: "", label: "همه باندها" },
  { value: "high", label: "بالا" },
  { value: "medium", label: "متوسط" },
  { value: "low", label: "پایین" },
];

const CALL_OUTCOME_OPTIONS = [
  { value: "", label: "همه نتایج تماس" },
  { value: "__never__", label: "بدون تماس ثبت‌شده" },
  ...CALL_OUTCOMES.map((outcome) => ({
    value: outcome,
    label: CALL_OUTCOME_LABELS[outcome],
  })),
];

type QuickChip = "all" | "overdue" | "today" | "new";

interface AssigneeOption {
  id: string;
  name: string;
}

interface ExpertConsultationFiltersProps {
  isAdmin?: boolean;
  assigneeOptions?: AssigneeOption[];
}

function readCallOutcomeFilter(params: URLSearchParams): string {
  if (params.get("onlyNeverCalled") === "true") {
    return "__never__";
  }
  return params.get("lastCallOutcome") ?? "";
}

function hasAdvancedFiltersActive(
  params: URLSearchParams,
  isAdmin: boolean,
): boolean {
  const keys = [
    "from",
    "to",
    "source",
    "purchaseProbabilityBand",
    "onlyPendingAssignment",
    "excludeAssessmentInProgress",
    "onlyStaleNew",
    "onlyHot",
    "onlyNeverCalled",
    "lastCallOutcome",
  ];
  if (keys.some((key) => Boolean(params.get(key)))) {
    return true;
  }
  // status=new is a quick chip; other statuses are advanced
  const status = params.get("status");
  if (status && status !== "new") {
    return true;
  }
  if (isAdmin) {
    if (params.get("onlyUnassigned") === "true" || params.get("assignedToId")) {
      return true;
    }
  }
  return false;
}

export function ExpertConsultationFilters({
  isAdmin = false,
  assigneeOptions = [],
}: ExpertConsultationFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [businessName, setBusinessName] = useState(
    searchParams.get("businessName") ?? "",
  );
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [assignedToId, setAssignedToId] = useState(
    searchParams.get("assignedToId") ?? "",
  );
  const [onlyUnassigned, setOnlyUnassigned] = useState(
    searchParams.get("onlyUnassigned") === "true",
  );
  const [onlyTeamQueue, setOnlyTeamQueue] = useState(
    searchParams.get("onlyTeamQueue") === "true" ||
      searchParams.get("onlyTeamQueue") === "1",
  );
  const [source, setSource] = useState(searchParams.get("source") ?? "");
  const [purchaseProbabilityBand, setPurchaseProbabilityBand] = useState(
    searchParams.get("purchaseProbabilityBand") ?? "",
  );
  const [onlyPendingAssignment, setOnlyPendingAssignment] = useState(
    searchParams.get("onlyPendingAssignment") === "true",
  );
  const [onlyOverdueFollowUp, setOnlyOverdueFollowUp] = useState(
    searchParams.get("onlyOverdueFollowUp") === "true",
  );
  const [onlyFollowUpDueToday, setOnlyFollowUpDueToday] = useState(
    searchParams.get("onlyFollowUpDueToday") === "true",
  );
  const [excludeAssessmentInProgress, setExcludeAssessmentInProgress] =
    useState(searchParams.get("excludeAssessmentInProgress") === "true");
  const [onlyStaleNew, setOnlyStaleNew] = useState(
    searchParams.get("onlyStaleNew") === "true",
  );
  const [onlyHot, setOnlyHot] = useState(
    searchParams.get("onlyHot") === "true",
  );
  const [callOutcomeFilter, setCallOutcomeFilter] = useState(() =>
    readCallOutcomeFilter(searchParams),
  );

  const activeChip: QuickChip = useMemo(() => {
    if (searchParams.get("onlyOverdueFollowUp") === "true") {
      return "overdue";
    }
    if (searchParams.get("onlyFollowUpDueToday") === "true") {
      return "today";
    }
    if (
      searchParams.get("status") === "new" &&
      searchParams.get("onlyOverdueFollowUp") !== "true" &&
      searchParams.get("onlyFollowUpDueToday") !== "true"
    ) {
      return "new";
    }
    return "all";
  }, [searchParams]);

  const advancedOpenByDefault = useMemo(
    () => hasAdvancedFiltersActive(searchParams, isAdmin),
    [searchParams, isAdmin],
  );
  const [advancedOpen, setAdvancedOpen] = useState(advancedOpenByDefault);

  useEffect(() => {
    if (advancedOpenByDefault) {
      setAdvancedOpen(true);
    }
  }, [advancedOpenByDefault]);

  useEffect(() => {
    setBusinessName(searchParams.get("businessName") ?? "");
    setPhone(searchParams.get("phone") ?? "");
    setFrom(searchParams.get("from") ?? "");
    setTo(searchParams.get("to") ?? "");
    setStatus(searchParams.get("status") ?? "");
    setAssignedToId(searchParams.get("assignedToId") ?? "");
    setOnlyUnassigned(searchParams.get("onlyUnassigned") === "true");
    setOnlyTeamQueue(
      searchParams.get("onlyTeamQueue") === "true" ||
        searchParams.get("onlyTeamQueue") === "1",
    );
    setSource(searchParams.get("source") ?? "");
    setPurchaseProbabilityBand(
      searchParams.get("purchaseProbabilityBand") ?? "",
    );
    setOnlyPendingAssignment(
      searchParams.get("onlyPendingAssignment") === "true",
    );
    setOnlyOverdueFollowUp(searchParams.get("onlyOverdueFollowUp") === "true");
    setOnlyFollowUpDueToday(
      searchParams.get("onlyFollowUpDueToday") === "true",
    );
    setExcludeAssessmentInProgress(
      searchParams.get("excludeAssessmentInProgress") === "true",
    );
    setOnlyStaleNew(searchParams.get("onlyStaleNew") === "true");
    setOnlyHot(searchParams.get("onlyHot") === "true");
    setCallOutcomeFilter(readCallOutcomeFilter(searchParams));
  }, [searchParams]);

  function buildBaseParams(): URLSearchParams {
    const params = new URLSearchParams();
    const view = searchParams.get("view");
    if (view) {
      params.set("view", view);
    }
    if (!isAdmin && onlyTeamQueue) {
      params.set("onlyTeamQueue", "true");
    }
    return params;
  }

  function pushParams(params: URLSearchParams) {
    params.set("page", "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyQuickChip(chip: QuickChip) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("onlyOverdueFollowUp");
    params.delete("onlyFollowUpDueToday");

    if (chip === "all") {
      if (params.get("status") === "new") {
        params.delete("status");
      }
    } else if (chip === "overdue") {
      params.set("onlyOverdueFollowUp", "true");
      if (params.get("status") === "new") {
        params.delete("status");
      }
    } else if (chip === "today") {
      params.set("onlyFollowUpDueToday", "true");
      if (params.get("status") === "new") {
        params.delete("status");
      }
    } else {
      params.set("status", "new");
    }

    pushParams(params);
  }

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (businessName.trim()) {
      params.set("businessName", businessName.trim());
    } else {
      params.delete("businessName");
    }
    if (phone.trim()) {
      params.set("phone", phone.trim());
    } else {
      params.delete("phone");
    }
    pushParams(params);
  }

  function applyAdvancedFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = buildBaseParams();

    if (businessName.trim()) {
      params.set("businessName", businessName.trim());
    }
    if (phone.trim()) {
      params.set("phone", phone.trim());
    }
    if (from) {
      params.set("from", from);
    }
    if (to) {
      params.set("to", to);
    }
    if (status) {
      params.set("status", status);
    }
    if (source) {
      params.set("source", source);
    }
    if (purchaseProbabilityBand) {
      params.set("purchaseProbabilityBand", purchaseProbabilityBand);
    }
    if (onlyPendingAssignment) {
      params.set("onlyPendingAssignment", "true");
    }
    if (onlyOverdueFollowUp) {
      params.set("onlyOverdueFollowUp", "true");
    }
    if (onlyFollowUpDueToday) {
      params.set("onlyFollowUpDueToday", "true");
    }
    if (excludeAssessmentInProgress) {
      params.set("excludeAssessmentInProgress", "true");
    }
    if (onlyStaleNew) {
      params.set("onlyStaleNew", "true");
    }
    if (onlyHot) {
      params.set("onlyHot", "true");
    }
    if (callOutcomeFilter === "__never__") {
      params.set("onlyNeverCalled", "true");
    } else if (callOutcomeFilter) {
      params.set("lastCallOutcome", callOutcomeFilter);
    }
    if (isAdmin) {
      if (onlyUnassigned) {
        params.set("onlyUnassigned", "true");
      } else if (assignedToId) {
        params.set("assignedToId", assignedToId);
      }
    }

    pushParams(params);
  }

  function clearFilters() {
    setBusinessName("");
    setPhone("");
    setFrom("");
    setTo("");
    setStatus("");
    setAssignedToId("");
    setOnlyUnassigned(false);
    setOnlyTeamQueue(false);
    setSource("");
    setPurchaseProbabilityBand("");
    setOnlyPendingAssignment(false);
    setOnlyOverdueFollowUp(false);
    setOnlyFollowUpDueToday(false);
    setExcludeAssessmentInProgress(false);
    setOnlyStaleNew(false);
    setOnlyHot(false);
    setCallOutcomeFilter("");
    const view = searchParams.get("view");
    router.push(view ? `${pathname}?view=${view}` : pathname);
  }

  const chips: Array<{ id: QuickChip; label: string }> = [
    { id: "all", label: "همه" },
    { id: "overdue", label: "پیگیری عقب‌افتاده" },
    { id: "today", label: "پیگیری امروز" },
    { id: "new", label: "لید جدید" },
  ];

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <form
        onSubmit={applySearch}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
      >
        <FieldLabel label="نام کسب‌وکار" htmlFor="filter-business">
          <Input
            id="filter-business"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
        </FieldLabel>

        <FieldLabel label="موبایل" htmlFor="filter-phone">
          <Input
            id="filter-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </FieldLabel>

        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">
            جستجو
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={clearFilters}
          >
            پاک کردن
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-600">فیلتر سریع:</span>
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => applyQuickChip(chip.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeChip === chip.id
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
            )}
            aria-pressed={activeChip === chip.id}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <details
        className="rounded-xl border border-zinc-200 bg-zinc-50/60"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-800">
          فیلترهای بیشتر
        </summary>

        <form
          onSubmit={applyAdvancedFilters}
          className="grid gap-4 border-t border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FieldLabel label="وضعیت" htmlFor="filter-status">
            <Select
              id="filter-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="منبع" htmlFor="filter-source">
            <Select
              id="filter-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "all-source"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="باند احتمال خرید" htmlFor="filter-probability">
            <Select
              id="filter-probability"
              value={purchaseProbabilityBand}
              onChange={(event) =>
                setPurchaseProbabilityBand(event.target.value)
              }
            >
              {PROBABILITY_BAND_OPTIONS.map((option) => (
                <option key={option.value || "all-band"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="نتیجه آخرین تماس" htmlFor="filter-call-outcome">
            <Select
              id="filter-call-outcome"
              value={callOutcomeFilter}
              onChange={(event) => setCallOutcomeFilter(event.target.value)}
            >
              {CALL_OUTCOME_OPTIONS.map((option) => (
                <option key={option.value || "all-call"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="فیلترهای ویژه" htmlFor="filter-pending">
            <div className="flex min-h-10 flex-col justify-center gap-2 text-sm text-zinc-700">
              <label className="flex items-center gap-2">
                <input
                  id="filter-pending"
                  type="checkbox"
                  checked={onlyPendingAssignment}
                  onChange={(event) =>
                    setOnlyPendingAssignment(event.target.checked)
                  }
                  className="rounded border-zinc-300"
                />
                فقط در صف تخصیص
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="filter-overdue"
                  type="checkbox"
                  checked={onlyOverdueFollowUp}
                  onChange={(event) =>
                    setOnlyOverdueFollowUp(event.target.checked)
                  }
                  className="rounded border-zinc-300"
                />
                فقط پیگیری عقب‌افتاده
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="filter-follow-up-today"
                  type="checkbox"
                  checked={onlyFollowUpDueToday}
                  onChange={(event) =>
                    setOnlyFollowUpDueToday(event.target.checked)
                  }
                  className="rounded border-zinc-300"
                />
                پیگیری امروز
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="filter-exclude-in-progress"
                  type="checkbox"
                  checked={excludeAssessmentInProgress}
                  onChange={(event) =>
                    setExcludeAssessmentInProgress(event.target.checked)
                  }
                  className="rounded border-zinc-300"
                />
                صف تماس (بدون در حال تست)
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="filter-stale-new"
                  type="checkbox"
                  checked={onlyStaleNew}
                  onChange={(event) => setOnlyStaleNew(event.target.checked)}
                  className="rounded border-zinc-300"
                />
                فقط لید جدید کهنه
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="filter-hot"
                  type="checkbox"
                  checked={onlyHot}
                  onChange={(event) => setOnlyHot(event.target.checked)}
                  className="rounded border-zinc-300"
                />
                فقط hot (احتمال بالا)
              </label>
              {!isAdmin ? (
                <label className="flex items-center gap-2">
                  <input
                    id="filter-team-queue"
                    type="checkbox"
                    checked={onlyTeamQueue}
                    onChange={(event) => setOnlyTeamQueue(event.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  صف تیم (بدون تخصیص)
                </label>
              ) : null}
            </div>
          </FieldLabel>

          {isAdmin ? (
            <>
              <FieldLabel label="کارشناس" htmlFor="filter-assignee">
                <Select
                  id="filter-assignee"
                  value={onlyUnassigned ? "" : assignedToId}
                  onChange={(event) => {
                    setAssignedToId(event.target.value);
                    setOnlyUnassigned(false);
                  }}
                  disabled={onlyUnassigned}
                >
                  <option value="">همه کارشناس‌ها</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="تخصیص" htmlFor="filter-unassigned">
                <label className="flex h-10 items-center gap-2 text-sm text-zinc-700">
                  <input
                    id="filter-unassigned"
                    type="checkbox"
                    checked={onlyUnassigned}
                    onChange={(event) => {
                      setOnlyUnassigned(event.target.checked);
                      if (event.target.checked) {
                        setAssignedToId("");
                      }
                    }}
                    className="rounded border-zinc-300"
                  />
                  فقط بدون تخصیص
                </label>
              </FieldLabel>
            </>
          ) : null}

          <FieldLabel label="از تاریخ" htmlFor="filter-from">
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </FieldLabel>

          <FieldLabel label="تا تاریخ" htmlFor="filter-to">
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </FieldLabel>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm">
              اعمال فیلتر
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={clearFilters}
            >
              پاک کردن
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
