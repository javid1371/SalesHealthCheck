"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const STATUS_OPTIONS = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "new", label: "جدید" },
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

interface AssigneeOption {
  id: string;
  name: string;
}

interface ExpertConsultationFiltersProps {
  isAdmin?: boolean;
  assigneeOptions?: AssigneeOption[];
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
  const [source, setSource] = useState(searchParams.get("source") ?? "");
  const [purchaseProbabilityBand, setPurchaseProbabilityBand] = useState(
    searchParams.get("purchaseProbabilityBand") ?? "",
  );
  const [onlyPendingAssignment, setOnlyPendingAssignment] = useState(
    searchParams.get("onlyPendingAssignment") === "true",
  );
  const [onlyHot, setOnlyHot] = useState(
    searchParams.get("onlyHot") === "true",
  );

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
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
    if (onlyHot) {
      params.set("onlyHot", "true");
    }
    if (isAdmin) {
      if (onlyUnassigned) {
        params.set("onlyUnassigned", "true");
      } else if (assignedToId) {
        params.set("assignedToId", assignedToId);
      }
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setBusinessName("");
    setPhone("");
    setFrom("");
    setTo("");
    setStatus("");
    setAssignedToId("");
    setOnlyUnassigned(false);
    setSource("");
    setPurchaseProbabilityBand("");
    setOnlyPendingAssignment(false);
    setOnlyHot(false);
    router.push(pathname);
  }

  return (
    <form
      onSubmit={applyFilters}
      className="mb-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
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
          onChange={(event) => setPurchaseProbabilityBand(event.target.value)}
        >
          {PROBABILITY_BAND_OPTIONS.map((option) => (
            <option key={option.value || "all-band"} value={option.value}>
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
              onChange={(event) => setOnlyPendingAssignment(event.target.checked)}
              className="rounded border-zinc-300"
            />
            فقط در صف تخصیص
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
        <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
          پاک کردن
        </Button>
      </div>
    </form>
  );
}
