"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  patchStaffUserRequest,
  resetStaffUserPasswordRequest,
  setStaffUserActiveRequest,
} from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";
import type { StaffUserSummary } from "@/modules/staff/staff.types";

const ROLE_LABELS: Record<StaffUserSummary["role"], string> = {
  admin: "ادمین",
  sales_expert: "کارشناس فروش",
};

function generatePassword(length = 12): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

interface StaffRowProps {
  user: StaffUserSummary;
}

export function StaffRow({ user }: StaffRowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [maxDailyCalls, setMaxDailyCalls] = useState(
    user.maxDailyCalls != null ? String(user.maxDailyCalls) : "",
  );
  const isPaused = Boolean(user.assignmentPausedAt);
  const isSalesExpert = user.role === "sales_expert";

  async function handleToggleActive() {
    setError(null);
    setLoading(true);
    try {
      await setStaffUserActiveRequest(user.id, !user.isActive);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در تغییر وضعیت کاربر.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePause() {
    setError(null);
    setLoading(true);
    try {
      await patchStaffUserRequest(user.id, {
        assignmentPaused: !isPaused,
        assignmentPausedReason: isPaused ? null : "توقف موقت از پنل ادمین",
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در تغییر وضعیت توقف تخصیص.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMaxDailyCalls() {
    setError(null);
    setLoading(true);
    try {
      const trimmed = maxDailyCalls.trim();
      const value =
        trimmed.length === 0 ? null : Number.parseInt(trimmed, 10);
      if (value !== null && (!Number.isInteger(value) || value < 1)) {
        throw new Error("سقف تماس روزانه باید عدد صحیح مثبت باشد.");
      }
      await patchStaffUserRequest(user.id, { maxDailyCalls: value });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "خطا در ذخیره سقف تماس روزانه.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setNewPassword(null);
    setLoading(true);
    const password = generatePassword();
    try {
      const result = await resetStaffUserPasswordRequest(user.id, password);
      setNewPassword(result.password);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطا در ریست رمز عبور.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="hover:bg-zinc-50/80">
      <td className="px-4 py-3 font-medium text-zinc-900">{user.name}</td>
      <td className="px-4 py-3 text-zinc-600" dir="ltr">
        {user.phone}
      </td>
      <td className="px-4 py-3 text-zinc-600">{ROLE_LABELS[user.role]}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <span
            className={
              user.isActive
                ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-800"
                : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-600"
            }
          >
            {user.isActive ? "فعال" : "غیرفعال"}
          </span>
          {isSalesExpert && isPaused ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-800">
              توقف تخصیص
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-600">
        {user.lastLoginAt ?? "—"}
      </td>
      <td className="px-4 py-3 text-zinc-600">
        {isSalesExpert ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="بدون سقف"
              value={maxDailyCalls}
              onChange={(event) => setMaxDailyCalls(event.target.value)}
              className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
              disabled={loading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleSaveMaxDailyCalls()}
              disabled={loading}
            >
              ذخیره
            </Button>
          </div>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleToggleActive}
              disabled={loading}
              loading={loading}
            >
              {user.isActive ? "غیرفعال‌کردن" : "فعال‌سازی"}
            </Button>
            {isSalesExpert ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleTogglePause()}
                disabled={loading || !user.isActive}
              >
                {isPaused ? "ازسرگیری تخصیص" : "توقف تخصیص"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetPassword}
              disabled={loading}
            >
              ریست رمز
            </Button>
          </div>
          {newPassword ? (
            <p className="text-xs text-amber-800" dir="ltr">
              رمز جدید: <strong>{newPassword}</strong>
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
