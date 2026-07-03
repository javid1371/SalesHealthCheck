import { env } from "@/lib/env";
import { getKavenegarConfig } from "@/modules/sms-funnel/funnel-config.service";
import type { SmsSender, SmsSendResult } from "./sms.types";

type KavenegarReturnPayload = {
  return?: {
    status?: number;
    message?: string;
  };
  entries?: Array<{
    messageid?: number;
    messageId?: number;
  }>;
};

function createDevSmsSender(): SmsSender {
  return {
    async sendOtp(phone: string, code: string): Promise<void> {
      console.log(
        `[dev] OTP for ${phone}: ${code} (KAVENEGAR_API_KEY not configured — SMS skipped)`,
      );
    },
    async sendMessage(phone: string, message: string): Promise<SmsSendResult> {
      console.log(`[dev] SMS to ${phone}:\n${message}`);
      return {};
    },
  };
}

async function parseKavenegarResponse(
  response: Response,
  context: string,
): Promise<KavenegarReturnPayload> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kavenegar ${context} failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as KavenegarReturnPayload;
  const status = payload.return?.status;
  if (status !== 200) {
    throw new Error(
      `Kavenegar ${context} rejected: ${payload.return?.message ?? "unknown error"}`,
    );
  }

  return payload;
}

function createKavenegarSender(
  apiKey: string,
  template: string,
  senderLine?: string,
): SmsSender {
  return {
    async sendOtp(phone: string, code: string): Promise<void> {
      const params = new URLSearchParams({
        receptor: phone,
        token: code,
        template,
      });

      const url = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json?${params.toString()}`;
      await parseKavenegarResponse(await fetch(url, { method: "GET" }), "OTP");
    },
    async sendMessage(phone: string, message: string): Promise<SmsSendResult> {
      if (!senderLine) {
        throw new Error(
          "KAVENEGAR_SENDER_LINE is required for free-text SMS",
        );
      }

      const params = new URLSearchParams({
        receptor: phone,
        sender: senderLine,
        message,
      });

      const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json?${params.toString()}`;
      const payload = await parseKavenegarResponse(
        await fetch(url, { method: "GET" }),
        "SMS send",
      );

      const entry = payload.entries?.[0];
      const messageId = entry?.messageid ?? entry?.messageId;
      return {
        providerMessageId:
          messageId !== undefined ? String(messageId) : undefined,
      };
    },
  };
}

export interface SmsSenderConfig {
  apiKey?: string;
  template?: string;
  senderLine?: string;
}

export function createSmsSender(config?: SmsSenderConfig): SmsSender {
  const apiKey = config?.apiKey ?? env.kavenegarApiKey;
  const template = config?.template ?? env.kavenegarOtpTemplate;
  const senderLine = config?.senderLine ?? env.kavenegarSenderLine;

  if (apiKey && template) {
    return createKavenegarSender(apiKey, template, senderLine);
  }

  return createDevSmsSender();
}

export async function createSmsSenderFromSettings(): Promise<SmsSender> {
  const kavenegar = await getKavenegarConfig();
  return createSmsSender({
    apiKey: env.kavenegarApiKey,
    template: kavenegar.otpTemplate,
    senderLine: kavenegar.senderLine,
  });
}
