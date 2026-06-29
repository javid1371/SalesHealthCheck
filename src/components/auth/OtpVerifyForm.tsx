"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import {
  formatAuthApiError,
  sendOtpRequest,
  verifyOtpRequest,
} from "@/lib/auth-client";
import { clearDevOtp, readDevOtp, storeDevOtp } from "@/lib/dev-otp";

const RESEND_COOLDOWN_SECONDS = 60;

interface OtpVerifyFormProps {
  phone: string;
  onVerified: () => void;
  onChangePhone?: () => void;
}

export function OtpVerifyForm({
  phone,
  onVerified,
  onChangePhone,
}: OtpVerifyFormProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    setDevCode(readDevOtp(phone));
  }, [phone]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(code.trim())) {
      setError("لطفاً کد ۶ رقمی را وارد کنید.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyOtpRequest(phone, code.trim());
      clearDevOtp();
      onVerified();
    } catch (err) {
      setError(formatAuthApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) {
      return;
    }

    setError(null);
    setResending(true);
    try {
      const result = await sendOtpRequest(phone);
      if (result.devCode) {
        storeDevOtp(phone, result.devCode);
        setDevCode(result.devCode);
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(formatAuthApiError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <Card as="form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {error && <ErrorMessage message={error} />}

      {devCode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">حالت توسعه — SMS ارسال نمی‌شود</p>
          <p className="mt-1">
            کد تأیید:{" "}
            <span className="font-mono text-base font-semibold tracking-widest" dir="ltr">
              {devCode}
            </span>
          </p>
        </div>
      )}

      <p className="text-sm text-zinc-600">
        کد تأیید به شماره{" "}
        <span className="font-medium text-zinc-900" dir="ltr">
          {phone}
        </span>{" "}
        ارسال شد.
      </p>

      <FieldLabel label="کد تأیید" required>
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          dir="ltr"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
        />
      </FieldLabel>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingLabel="در حال تأیید..."
      >
        تأیید و ادامه
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={resendCooldown > 0 || resending}
          loading={resending}
          loadingLabel="در حال ارسال..."
          onClick={() => void handleResend()}
        >
          {resendCooldown > 0
            ? `ارسال مجدد (${resendCooldown} ثانیه)`
            : "ارسال مجدد کد"}
        </Button>

        {onChangePhone && (
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-800"
            onClick={onChangePhone}
          >
            تغییر شماره
          </button>
        )}
      </div>
    </Card>
  );
}
