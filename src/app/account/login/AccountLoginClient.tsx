"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OtpPhoneForm } from "@/components/auth/OtpPhoneForm";
import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";
import { PageLayout } from "@/components/layout/PageLayout";
import { storeDevOtp } from "@/lib/dev-otp";

type LoginStep = "phone" | "verify";

export function AccountLoginClient() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState("");

  return (
    <PageLayout
      title={step === "phone" ? "ورود" : "ورود کد تأیید"}
      subtitle={
        step === "phone"
          ? "برای مشاهده تست‌های قبلی، شماره موبایل خود را وارد کنید."
          : "کد ۶ رقمی ارسال‌شده را وارد کنید."
      }
      showBack={step === "phone"}
      backHref="/"
      maxWidth="md"
    >
      {step === "phone" ? (
        <>
          <OtpPhoneForm
            defaultPhone={phone}
            onSent={(nextPhone, devCode) => {
              if (devCode) {
                storeDevOtp(nextPhone, devCode);
              }
              setPhone(nextPhone);
              setStep("verify");
            }}
          />
          <p className="mt-6 text-center text-sm text-zinc-600">
            ارزیابی جدید می‌خواهید؟{" "}
            <Link
              href="/assessment/start"
              className="font-medium text-emerald-700 hover:text-emerald-800"
            >
              شروع ارزیابی
            </Link>
          </p>
        </>
      ) : (
        <OtpVerifyForm
          phone={phone}
          onVerified={() => router.push("/account/assessments")}
          onChangePhone={() => setStep("phone")}
        />
      )}
    </PageLayout>
  );
}
