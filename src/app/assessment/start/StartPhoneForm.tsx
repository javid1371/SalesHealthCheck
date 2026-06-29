"use client";

import { useRouter } from "next/navigation";
import { OtpPhoneForm } from "@/components/auth/OtpPhoneForm";

export function StartPhoneForm() {
  const router = useRouter();

  function handleSent(phone: string) {
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
