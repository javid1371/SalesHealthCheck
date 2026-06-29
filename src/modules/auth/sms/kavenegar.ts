import { env } from "@/lib/env";
import type { SmsSender } from "./sms.types";

type KavenegarLookupResponse = {
  return?: {
    status?: number;
    message?: string;
  };
};

function createDevSmsSender(): SmsSender {
  return {
    async sendOtp(phone: string, code: string): Promise<void> {
      console.log(
        `[dev] OTP for ${phone}: ${code} (KAVENEGAR_API_KEY not configured — SMS skipped)`,
      );
    },
  };
}

function createKavenegarSender(apiKey: string, template: string): SmsSender {
  return {
    async sendOtp(phone: string, code: string): Promise<void> {
      const params = new URLSearchParams({
        receptor: phone,
        token: code,
        template,
      });

      const url = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json?${params.toString()}`;
      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Kavenegar OTP request failed (${response.status}): ${body}`,
        );
      }

      const payload = (await response.json()) as KavenegarLookupResponse;
      const status = payload.return?.status;
      if (status !== 200) {
        throw new Error(
          `Kavenegar OTP rejected: ${payload.return?.message ?? "unknown error"}`,
        );
      }
    },
  };
}

export function createSmsSender(): SmsSender {
  const apiKey = env.kavenegarApiKey;
  const template = env.kavenegarOtpTemplate;

  if (apiKey && template) {
    return createKavenegarSender(apiKey, template);
  }

  return createDevSmsSender();
}
