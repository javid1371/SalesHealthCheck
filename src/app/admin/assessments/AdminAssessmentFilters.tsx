"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const STATUS_OPTIONS = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "started", label: "شروع شده" },
  { value: "in_progress", label: "در حال انجام" },
  { value: "completed", label: "تکمیل شده" },
  { value: "abandoned", label: "رها شده" },
];

export function AdminAssessmentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      const trimmed = String(value).trim();
      if (trimmed) {
        params.set(key, trimmed);
      }
    }

    params.set("page", "1");

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `/admin/assessments?${query}` : "/admin/assessments");
    });
  }

  function handleReset() {
    startTransition(() => {
      router.push("/admin/assessments");
    });
  }

  return (
    <Card padding="compact" className="mb-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FieldLabel label="نام کسب‌وکار" htmlFor="admin-filter-business">
          <Input
            id="admin-filter-business"
            name="businessName"
            defaultValue={searchParams.get("businessName") ?? ""}
            placeholder="جستجو…"
            disabled={isPending}
          />
        </FieldLabel>

        <FieldLabel label="شماره موبایل" htmlFor="admin-filter-phone">
          <Input
            id="admin-filter-phone"
            name="phone"
            defaultValue={searchParams.get("phone") ?? ""}
            placeholder="09…"
            dir="ltr"
            className="text-left"
            disabled={isPending}
          />
        </FieldLabel>

        <FieldLabel label="وضعیت" htmlFor="admin-filter-status">
          <Select
            id="admin-filter-status"
            name="status"
            defaultValue={searchParams.get("status") ?? ""}
            disabled={isPending}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel label="از تاریخ" htmlFor="admin-filter-from">
          <Input
            id="admin-filter-from"
            name="from"
            type="date"
            defaultValue={searchParams.get("from") ?? ""}
            disabled={isPending}
          />
        </FieldLabel>

        <FieldLabel label="تا تاریخ" htmlFor="admin-filter-to">
          <Input
            id="admin-filter-to"
            name="to"
            type="date"
            defaultValue={searchParams.get("to") ?? ""}
            disabled={isPending}
          />
        </FieldLabel>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" loading={isPending} loadingLabel="در حال جستجو…">
            اعمال فیلتر
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleReset}
            disabled={isPending}
          >
            پاک کردن
          </Button>
        </div>
      </form>
    </Card>
  );
}
