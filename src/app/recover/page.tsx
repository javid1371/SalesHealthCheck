"use client";

import Link from "next/link";
import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { apiPost, ApiClientError } from "@/lib/api-client";
import type { RecoverAccessResponse } from "@/modules/access-recovery/access-recovery.types";
import { RECOVER_ACCESS_SUCCESS_MESSAGE } from "@/modules/access-recovery/access-recovery.types";

export default function RecoverPage() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!phone.trim()) {
      setError("لطفاً شماره تماس را وارد کنید.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiPost<RecoverAccessResponse>("/api/access/recover", {
        phone: phone.trim(),
      });
      setSuccessMessage(result.message);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "rate_limited") {
          const retryAfter =
            typeof err.details === "object" &&
            err.details !== null &&
            "retry_after" in err.details
              ? Number((err.details as { retry_after: number }).retry_after)
              : null;
          setError(
            retryAfter
              ? `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${retryAfter} ثانیه دیگر تلاش کنید.`
              : err.message,
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="بازیابی لینک نتیجه"
      subtitle="شماره موبایلی که با آن ارزیابی را شروع کردید را وارد کنید. اگر ارزیابی تکمیل‌شده‌ای داشته باشید، لینک نتیجه برایتان ارسال می‌شود."
      showBack
      backHref="/"
      maxWidth="md"
    >
      <Card as="form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {error && <ErrorMessage message={error} />}
        {successMessage && (
          <Alert variant="success" title="درخواست ثبت شد">
            <p>{successMessage}</p>
            {successMessage === RECOVER_ACCESS_SUCCESS_MESSAGE && (
              <>
                <p className="mt-2">
                  اگر ایمیل ثبت کرده باشید، صندوق ورودی و پوشه اسپم را بررسی کنید.
                </p>
                <p className="mt-2">
                  یا از بخش{" "}
                  <Link
                    href="/account/login"
                    className="font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    حساب من
                  </Link>{" "}
                  با همان شماره وارد شوید.
                </p>
              </>
            )}
          </Alert>
        )}

        <FieldLabel label="شماره تماس" required>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09123456789"
            dir="ltr"
            autoComplete="tel"
            required
          />
        </FieldLabel>

        <Button
          type="submit"
          fullWidth
          loading={submitting}
          loadingLabel="در حال ارسال..."
        >
          ارسال لینک بازیابی
        </Button>

        <p className="text-center text-sm text-zinc-500">
          یا از بخش{" "}
          <Link
            href="/account/login"
            className="font-medium text-emerald-700 hover:text-emerald-800"
          >
            حساب من
          </Link>{" "}
          با همان شماره وارد شوید.
        </p>

        <p className="text-center text-sm text-zinc-600">
          ارزیابی جدید می‌خواهید؟{" "}
          <Link href="/assessment/start" className="font-medium text-emerald-700 hover:text-emerald-800">
            شروع ارزیابی
          </Link>
        </p>
      </Card>
    </PageLayout>
  );
}
