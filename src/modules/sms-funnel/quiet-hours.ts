import { env } from "@/lib/env";

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

export interface QuietHoursOptions {
  start?: number;
  end?: number;
}

function resolveQuietHours(options?: QuietHoursOptions): {
  start: number;
  end: number;
} {
  return {
    start: options?.start ?? env.smsQuietHoursStart,
    end: options?.end ?? env.smsQuietHoursEnd,
  };
}

function getTehranHour(date: Date): number {
  const tehranTime = new Date(date.getTime() + TEHRAN_OFFSET_MS);
  return tehranTime.getUTCHours();
}

function isWithinQuietHoursHour(
  hour: number,
  start: number,
  end: number,
): boolean {
  if (start === end) return true;
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export function isWithinSmsQuietHours(
  date = new Date(),
  options?: QuietHoursOptions,
): boolean {
  const { start, end } = resolveQuietHours(options);
  return isWithinQuietHoursHour(getTehranHour(date), start, end);
}

export function nextAllowedSmsSendTime(
  from = new Date(),
  options?: QuietHoursOptions,
): Date {
  if (isWithinSmsQuietHours(from, options)) {
    return from;
  }

  const candidate = new Date(from.getTime());
  for (let i = 0; i < 48; i += 1) {
    candidate.setTime(candidate.getTime() + 30 * 60 * 1000);
    if (isWithinSmsQuietHours(candidate, options)) {
      return candidate;
    }
  }

  return from;
}
