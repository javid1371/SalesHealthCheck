"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SalesModel } from "@prisma/client";
import { PageLayout } from "@/components/layout/PageLayout";
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
import type { StartAssessmentResponse } from "@/modules/assessment/assessment.types";

export default function BusinessInfoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    if (!email.trim() && !phone.trim()) {
      setError("لطفاً ایمیل یا شماره تماس را وارد کنید.");
      return;
    }
    if (!businessName.trim()) {
      setError("لطفاً نام کسب‌وکار را وارد کنید.");
      return;
    }
    if (!teamSize.trim()) {
      setError("لطفاً اندازه تیم را وارد کنید.");
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
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          },
          organization: {
            businessName: businessName.trim(),
            ...(industry.trim() ? { industry: industry.trim() } : {}),
            teamSize: teamSize.trim(),
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
    <PageLayout
      title="اطلاعات کسب‌وکار"
      subtitle="این اطلاعات برای شخصی‌سازی گزارش استفاده می‌شود."
      showBack
      backHref="/assessment/start"
      maxWidth="md"
    >
      <Card as="form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {error && <ErrorMessage message={error} />}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-900">
            اطلاعات تماس
          </legend>
          <FieldLabel label="نام" required>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام شما"
            />
          </FieldLabel>
          <FieldLabel label="ایمیل">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              dir="ltr"
            />
          </FieldLabel>
          <FieldLabel label="شماره تماس">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
              dir="ltr"
            />
          </FieldLabel>
          <p className="text-xs text-zinc-500">
            حداقل یکی از ایمیل یا شماره تماس الزامی است.
          </p>
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
            <Input
              type="text"
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              placeholder="مثلاً ۵ نفر"
            />
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
    </PageLayout>
  );
}
