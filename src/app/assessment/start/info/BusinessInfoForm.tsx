"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SalesModel } from "@prisma/client";
import { PrivacyConsentCheckbox } from "@/components/legal/PrivacyConsentCheckbox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { apiPost, ApiClientError } from "@/lib/api-client";
import { saveResultToken } from "@/lib/assessment-storage";
import { SALES_MODEL_OPTIONS } from "@/lib/sales-model";
import { TEAM_SIZE_OPTIONS } from "@/lib/team-size";
import type { StartAssessmentResponse } from "@/modules/assessment/assessment.types";

interface BusinessInfoFormProps {
  phone: string;
  defaultName?: string;
}

export function BusinessInfoForm({
  phone,
  defaultName = "",
}: BusinessInfoFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [salesModel, setSalesModel] = useState<SalesModel | "">("");
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("لطفاً نام خود را وارد کنید.");
      return;
    }
    if (!businessName.trim()) {
      setError("لطفاً نام کسب‌وکار را وارد کنید.");
      return;
    }
    if (!teamSize) {
      setError("لطفاً اندازه تیم را انتخاب کنید.");
      return;
    }
    if (!salesModel) {
      setError("لطفاً مدل فروش را انتخاب کنید.");
      return;
    }
    if (!consented) {
      setError("لطفاً با سیاست حریم خصوصی موافقت کنید.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiPost<StartAssessmentResponse>(
        "/api/assessments/start",
        {
          user: {
            name: name.trim(),
          },
          organization: {
            businessName: businessName.trim(),
            ...(industry.trim() ? { industry: industry.trim() } : {}),
            teamSize,
            salesModel,
          },
        },
      );

      saveResultToken(result.assessmentId, result.resultToken);
      router.push(`/assessment/${result.assessmentId}/questions/0`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {error && <ErrorMessage message={error} />}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900">
          اطلاعات تماس
        </legend>
        <FieldLabel label="شماره تماس">
          <Input
            type="tel"
            value={phone}
            readOnly
            disabled
            dir="ltr"
          />
        </FieldLabel>
        <p className="text-xs text-zinc-500">
          این شماره با کد تأیید OTP تأیید شده و قابل تغییر نیست.
        </p>
        <FieldLabel label="نام" required>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام شما"
          />
        </FieldLabel>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900">
          اطلاعات کسب‌وکار
        </legend>
        <FieldLabel label="نام کسب‌وکار" required>
          <Input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="نام برند یا شرکت"
          />
        </FieldLabel>
        <FieldLabel label="حوزه فعالیت">
          <Input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="مثلاً فروش آنلاین پوشاک"
          />
        </FieldLabel>
        <FieldLabel label="اندازه تیم" required>
          <Select
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
          >
            <option value="">انتخاب کنید</option>
            {TEAM_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel label="مدل فروش" required>
          <Select
            value={salesModel}
            onChange={(e) => setSalesModel(e.target.value as SalesModel)}
          >
            <option value="">انتخاب کنید</option>
            {SALES_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FieldLabel>
      </fieldset>

      <PrivacyConsentCheckbox
        id="start-privacy-consent"
        checked={consented}
        onChange={setConsented}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingLabel="در حال ثبت..."
      >
        شروع سوالات
      </Button>
    </Card>
  );
}
