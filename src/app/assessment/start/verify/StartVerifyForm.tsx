"use client";

import { useRouter } from "next/navigation";
import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";

interface StartVerifyFormProps {
  phone: string;
}

export function StartVerifyForm({ phone }: StartVerifyFormProps) {
  const router = useRouter();

  return (
    <OtpVerifyForm
      phone={phone}
      onVerified={() => router.push("/assessment/start/info")}
      onChangePhone={() => router.push("/assessment/start")}
    />
  );
}
