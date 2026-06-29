"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { formatAuthApiError, sendOtpRequest } from "@/lib/auth-client";
import { OTP_SEND_SUCCESS_MESSAGE } from "@/modules/auth/auth.types";

interface OtpPhoneFormProps {
  defaultPhone?: string;
  onSent: (phone: string, devCode?: string) => void;
  submitLabel?: string;
}

export function OtpPhoneForm({
  defaultPhone = "",
  onSent,
  submitLabel = "دریافت کد تأیید",
}: OtpPhoneFormProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("لطفاً شماره موبایل خود را وارد کنید.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await sendOtpRequest(phone.trim());
      onSent(phone.trim(), result.devCode);
    } catch (err) {
      setError(formatAuthApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {error && <ErrorMessage message={error} />}

      <FieldLabel label="شماره موبایل" required>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09123456789"
          dir="ltr"
          autoComplete="tel"
          inputMode="numeric"
        />
      </FieldLabel>

      <p className="text-sm text-zinc-500">{OTP_SEND_SUCCESS_MESSAGE}</p>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingLabel="در حال ارسال..."
      >
        {submitLabel}
      </Button>
    </Card>
  );
}
