"use client";

import { useRouter } from "next/navigation";
import { OtpPhoneForm } from "@/components/auth/OtpPhoneForm";
import { storeDevOtp } from "@/lib/dev-otp";

export function StartPhoneForm() {
  const router = useRouter();

  function handleSent(phone: string, devCode?: string) {
    if (devCode) {
      storeDevOtp(phone, devCode);
    }
    router.push(
      `/assessment/start/verify?phone=${encodeURIComponent(phone)}`,
    );
  }

  return (
    <OtpPhoneForm
      onSent={handleSent}
      submitLabel="دریافت کد و ادامه"
    />
  );
}
