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
} as const;
