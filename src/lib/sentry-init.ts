import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";

function getServerDsn(): string | undefined {
  return process.env.SENTRY_DSN;
}

function getClientDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
}

export function isSentryEnabled(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(getServerDsn());
}

export function isClientSentryEnabled(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(getClientDsn());
}

export function getServerSentryOptions(): NodeOptions | EdgeOptions {
  return {
    dsn: getServerDsn(),
    enabled: isSentryEnabled(),
    tracesSampleRate: 0.1,
  };
}

export function getClientSentryOptions(): BrowserOptions {
  return {
    dsn: getClientDsn(),
    enabled: isClientSentryEnabled(),
    tracesSampleRate: 0.1,
  };
}
