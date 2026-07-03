"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { adminLoginRequest } from "@/lib/admin-client";
import { ApiClientError } from "@/lib/api-client";

export function AdminLoginClient() {
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
      await adminLoginRequest(phone.trim(), password);
      router.push("/admin/dashboard");
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
      title="ورود ادمین"
      subtitle="برای مشاهده و مدیریت ارزیابی‌ها، شماره موبایل و رمز عبور خود را وارد کنید."
      showBack
      backHref="/"
      maxWidth="md"
      footer="minimal"
    >
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <FieldLabel label="شماره موبایل" htmlFor="admin-phone" required>
            <Input
              id="admin-phone"
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

          <FieldLabel label="رمز عبور" htmlFor="admin-password" required>
            <Input
              id="admin-password"
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
