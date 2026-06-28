"use client";

import { useState } from "react";
import { PrivacyConsentCheckbox } from "@/components/legal/PrivacyConsentCheckbox";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { apiPost, ApiClientError } from "@/lib/api-client";
import { getResultToken } from "@/lib/assessment-storage";
import type { CreateConsultationRequestResponse } from "@/modules/assessment/assessment.types";

interface ConsultationFormProps {
  assessmentId: string;
  reportId?: string;
  onSuccess?: () => void;
}

export function ConsultationForm({
  assessmentId,
  reportId,
  onSuccess,
}: ConsultationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setError("حداقل یکی از ایمیل یا شماره تماس الزامی است.");
      return;
    }
    if (!consented) {
      setError("لطفاً با سیاست حریم خصوصی موافقت کنید.");
      return;
    }

    setLoading(true);
    setError(null);

    const token = getResultToken(assessmentId);

    try {
      await apiPost<CreateConsultationRequestResponse>(
        "/api/consultation-requests",
        {
          name,
          email: email || undefined,
          phone: phone || undefined,
          message: message || undefined,
          assessmentSessionId: assessmentId,
          reportId,
          token,
        },
      );
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ثبت درخواست با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Alert variant="success" title="درخواست شما ثبت شد" className="text-center">
        <p>
          به زودی برای بررسی دقیق‌تر گلوگاه فروش با شما تماس می‌گیریم.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {error && <ErrorMessage message={error} />}

      <FieldLabel label="نام و نام خانوادگی" required htmlFor="name">
        <Input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FieldLabel>

      <FieldLabel label="ایمیل" htmlFor="email">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FieldLabel>

      <FieldLabel label="شماره تماس" htmlFor="phone">
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
        />
      </FieldLabel>

      <p className="text-xs text-zinc-500">
        حداقل یکی از ایمیل یا شماره تماس الزامی است.
      </p>

      <FieldLabel label="توضیحات (اختیاری)" htmlFor="message">
        <Textarea
          id="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </FieldLabel>

      <PrivacyConsentCheckbox
        id="consultation-privacy-consent"
        checked={consented}
        onChange={setConsented}
      />

      <Button
        type="submit"
        fullWidth
        loading={loading}
        loadingLabel="در حال ارسال..."
      >
        ثبت درخواست تحلیل
      </Button>
    </form>
  );
}
