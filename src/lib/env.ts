import type { CapacityMode } from "@/types/report-spec";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCapacityMode(value: string | undefined): CapacityMode {
  if (value === "full") return "full";
  return "free";
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  get databaseUrl() {
    return requireEnv("DATABASE_URL");
  },
  /** Report Engine CTA routing; default `free` when CAPACITY_MODE is unset. */
  get capacityMode(): CapacityMode {
    return parseCapacityMode(process.env.CAPACITY_MODE);
  },
  /** Internal Expert View gate; unset allows access in non-production only. */
  get expertViewToken(): string | undefined {
    return process.env.EXPERT_VIEW_TOKEN;
  },
  /** Public app URL for recovery emails and absolute links. */
  get appBaseUrl(): string {
    return process.env.APP_BASE_URL ?? "http://localhost:3000";
  },
  get resendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY;
  },
  get emailFrom(): string | undefined {
    return process.env.EMAIL_FROM;
  },
  /** Sentry DSN — enabled in production when set. */
  get sentryDsn(): string | undefined {
    return process.env.SENTRY_DSN;
  },
  /** PDF export via Playwright; opt-in with PDF_GENERATION_ENABLED=true. */
  get pdfGenerationEnabled(): boolean {
    return process.env.PDF_GENERATION_ENABLED === "true";
  },
  /** HMAC secret for signed user/admin session cookies (ADR 0014). */
  get authSessionSecret(): string {
    return requireEnv("AUTH_SESSION_SECRET");
  },
  /** Kavenegar API key; unset in dev logs OTP instead of sending SMS. */
  get kavenegarApiKey(): string | undefined {
    return process.env.KAVENEGAR_API_KEY;
  },
  /** Kavenegar lookup/verify template name for OTP SMS. */
  get kavenegarOtpTemplate(): string | undefined {
    return process.env.KAVENEGAR_OTP_TEMPLATE;
  },
  /** Plain admin password; prefer ADMIN_PASSWORD_HASH in production. */
  get adminPassword(): string | undefined {
    return process.env.ADMIN_PASSWORD;
  },
  /** Bcrypt/scrypt hash of admin password; used when ADMIN_PASSWORD is unset. */
  get adminPasswordHash(): string | undefined {
    return process.env.ADMIN_PASSWORD_HASH;
  },
  /** Plain sales expert password for consultation leads panel. */
  get salesExpertPassword(): string | undefined {
    return process.env.SALES_EXPERT_PASSWORD;
  },
  /** Scrypt hash of sales expert password. */
  get salesExpertPasswordHash(): string | undefined {
    return process.env.SALES_EXPERT_PASSWORD_HASH;
  },
  /** OTP validity window in seconds; default 300. */
  get otpTtlSeconds(): number {
    return parsePositiveInt(process.env.OTP_TTL_SECONDS, 300);
  },
  /** Max failed OTP verify attempts per code; default 3. */
  get otpMaxAttempts(): number {
    return parsePositiveInt(process.env.OTP_MAX_ATTEMPTS, 3);
  },
  /** Telegram bot token; unset uses dev logger client. */
  get telegramBotToken(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  },
  /** Secret token for Telegram webhook validation header. */
  get telegramWebhookSecret(): string | undefined {
    return process.env.TELEGRAM_WEBHOOK_SECRET;
  },
  /** Bale bot token; unset uses dev logger client. */
  get baleBotToken(): string | undefined {
    return process.env.BALE_BOT_TOKEN;
  },
  /** Secret token for Bale webhook validation. */
  get baleWebhookSecret(): string | undefined {
    return process.env.BALE_WEBHOOK_SECRET;
  },
  /** Redis URL for BullMQ queues; unset disables async workers. */
  get redisUrl(): string | undefined {
    return process.env.REDIS_URL;
  },
  /** Enable SMS sales funnel automation. */
  get smsFunnelEnabled(): boolean {
    return process.env.SMS_FUNNEL_ENABLED === "true";
  },
  /** Enable sales funnel modeling module (/funnel pages and /api/funnels). */
  get salesFunnelEnabled(): boolean {
    return process.env.SALES_FUNNEL_ENABLED === "true";
  },
  /** Kavenegar dedicated sender line for free-text SMS. */
  get kavenegarSenderLine(): string | undefined {
    return process.env.KAVENEGAR_SENDER_LINE;
  },
  /** Quiet hours start (0-23, Asia/Tehran); default 9. */
  get smsQuietHoursStart(): number {
    return parsePositiveInt(process.env.SMS_QUIET_HOURS_START, 9);
  },
  /** Quiet hours end (0-23, Asia/Tehran); default 21. */
  get smsQuietHoursEnd(): number {
    return parsePositiveInt(process.env.SMS_QUIET_HOURS_END, 21);
  },
  /** Max nurture SMS without user reaction before dormant. */
  get smsFunnelMaxUnanswered(): number {
    return parsePositiveInt(process.env.SMS_FUNNEL_MAX_UNANSWERED, 4);
  },
  /** Secret for cron/reconciliation API routes. */
  get smsFunnelCronSecret(): string | undefined {
    return process.env.SMS_FUNNEL_CRON_SECRET;
  },
  /** Enable automatic lead assignment and expert SMS notifications. */
  get leadAutoAssignEnabled(): boolean {
    return process.env.LEAD_AUTO_ASSIGN_ENABLED === "true";
  },
  /** Hours to delay auto-assignment for system-detected hot leads; default 24. */
  get leadSystemAssignDelayHours(): number {
    return parsePositiveInt(process.env.LEAD_SYSTEM_ASSIGN_DELAY_HOURS, 24);
  },
} as const;
