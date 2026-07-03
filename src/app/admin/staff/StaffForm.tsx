"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createStaffUserRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";

interface StaffFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function StaffForm({ onCreated, onCancel }: StaffFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "sales_expert">("sales_expert");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createStaffUserRequest({ name, phone, password, role });
      onCreated();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("خطا در ساخت کاربر. دوباره تلاش کنید.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">
        افزودن کاربر داخلی
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="staff-name"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            نام
          </label>
          <input
            id="staff-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="staff-phone"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            موبایل
          </label>
          <input
            id="staff-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            dir="ltr"
            placeholder="09123456789"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="staff-password"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            رمز اولیه
          </label>
          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="staff-role"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            نقش
          </label>
          <select
            id="staff-role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "admin" | "sales_expert")
            }
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="sales_expert">کارشناس فروش</option>
            <option value="admin">ادمین</option>
          </select>
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" loading={loading} disabled={loading}>
            ساخت کاربر
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            انصراف
          </Button>
        </div>
      </form>
    </Card>
  );
}
