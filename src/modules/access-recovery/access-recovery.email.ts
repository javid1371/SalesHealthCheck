import { Resend } from "resend";
import { env } from "@/lib/env";
import type { RecoveryEmailPayload } from "./access-recovery.types";

function getResendClient(): Resend | null {
  const apiKey = env.resendApiKey;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function sendRecoveryEmail(
  payload: RecoveryEmailPayload,
): Promise<void> {
  const from = env.emailFrom;
  const resend = getResendClient();

  if (!from || !resend) {
    console.warn(
      "Recovery email skipped: RESEND_API_KEY or EMAIL_FROM not configured",
    );
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: "لینک نتیجه ارزیابی Sales Health Check",
    html: buildRecoveryEmailHtml(payload.resultUrl),
  });

  if (error) {
    console.error("Failed to send recovery email:", error);
  }
}

function buildRecoveryEmailHtml(resultUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
  <body style="font-family: Tahoma, Arial, sans-serif; line-height: 1.7; color: #18181b;">
    <p>سلام،</p>
    <p>درخواست بازیابی لینک نتیجه ارزیابی Sales Health Check دریافت شد.</p>
    <p>برای مشاهده نتیجه و گزارش خود، روی لینک زیر کلیک کنید:</p>
    <p style="margin: 24px 0;">
      <a href="${resultUrl}" style="color: #047857; font-weight: bold;">مشاهده نتیجه ارزیابی</a>
    </p>
    <p style="word-break: break-all; font-size: 14px; color: #52525b;" dir="ltr">${resultUrl}</p>
    <p style="font-size: 14px; color: #71717a;">
      اگر این درخواست را شما ارسال نکرده‌اید، این ایمیل را نادیده بگیرید.
    </p>
  </body>
</html>
`.trim();
}
