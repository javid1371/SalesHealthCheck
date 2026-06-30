"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";

export function ExpertConsultationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [businessName, setBusinessName] = useState(
    searchParams.get("businessName") ?? "",
  );
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

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
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setBusinessName("");
    setPhone("");
    setFrom("");
    setTo("");
    router.push(pathname);
  }

  return (
    <form
      onSubmit={applyFilters}
      className="mb-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
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

      <div className="flex items-end gap-2">
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
