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
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await adminLoginRequest(password);
      router.push("/admin/assessments");
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
      subtitle="برای مشاهده و مدیریت ارزیابی‌ها، رمز عبور ادمین را وارد کنید."
      showBack
      backHref="/"
      maxWidth="md"
      footer="minimal"
    >
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
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
