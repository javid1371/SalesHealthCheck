"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { ApiClientError } from "@/lib/api-client";
import { salesExpertLoginRequest } from "@/lib/expert-client";

export function ExpertLoginClient() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await salesExpertLoginRequest(phone.trim(), password);
      router.push("/expert/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
      );
      setLoading(false);
    }
  }

  return (
    <PageLayout
      title="ورود کارشناس فروش"
      subtitle="برای مشاهده درخواست‌های مشاوره، شماره موبایل و رمز عبور خود را وارد کنید."
      showBack
      backHref="/"
      maxWidth="md"
      footer="minimal"
    >
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FieldLabel label="شماره موبایل" htmlFor="expert-phone" required>
            <Input
              id="expert-phone"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              placeholder="09123456789"
              dir="ltr"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              disabled={loading}
            />
          </FieldLabel>

          <FieldLabel label="رمز عبور" htmlFor="expert-password" required>
            <Input
              id="expert-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
            />
          </FieldLabel>

          {error && <ErrorMessage message={error} />}

          <Button
            type="submit"
            fullWidth
            loading={loading}
            loadingLabel="در حال ورود…"
          >
            ورود
          </Button>
        </form>
      </Card>
    </PageLayout>
  );
}
