"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { SALES_MODEL_OPTIONS } from "@/lib/sales-model";
import type { FunnelResponse } from "@/modules/sales-funnel/sales-funnel.types";

interface CreateFunnelFormProps {
  onCreated?: (funnel: FunnelResponse) => void;
}

export function CreateFunnelForm({ onCreated }: CreateFunnelFormProps) {
  const router = useRouter();
  const [name, setName] = useState("قیف فروش جدید");
  const [prefillFromAssessment, setPrefillFromAssessment] = useState(true);
  const [salesModel, setSalesModel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const funnel = await apiPost<FunnelResponse>("/api/funnels", {
        name: name.trim(),
        prefillFromAssessment,
        ...(salesModel ? { salesModel } : {}),
      });

      onCreated?.(funnel);
      router.push(`/funnel/${funnel.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "ساخت قیف با خطا مواجه شد.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">قیف جدید</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FieldLabel label="نام قیف" htmlFor="funnel-name" required>
          <Input
            id="funnel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FieldLabel>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={prefillFromAssessment}
            onChange={(e) => setPrefillFromAssessment(e.target.checked)}
          />
          پیش‌پر از آخرین ارزیابی
        </label>

        {!prefillFromAssessment && (
          <FieldLabel label="مدل فروش" htmlFor="funnel-sales-model">
            <Select
              id="funnel-sales-model"
              value={salesModel}
              onChange={(e) => setSalesModel(e.target.value)}
            >
              <option value="">پیش‌فرض (ترکیبی)</option>
              {SALES_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldLabel>
        )}

        {error && <ErrorMessage message={error} />}

        <Button type="submit" loading={loading} loadingLabel="در حال ساخت…">
          ساخت قیف
        </Button>
      </form>
    </Card>
  );
}
