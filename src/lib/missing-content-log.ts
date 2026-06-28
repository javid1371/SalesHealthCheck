import type { FallbackFieldKey } from "@/config/model-v1/report-content/field-fallbacks";
import type { DomainLevel } from "@/types/structured-diagnosis";

export interface MissingContentEntry {
  field: FallbackFieldKey;
  domainSlug: string;
  level: DomainLevel;
  questionNumber?: number;
  score?: 0 | 1 | 2 | 3;
  timestamp: string;
}

const missingContentLog: MissingContentEntry[] = [];

export function logMissingContent(
  entry: Omit<MissingContentEntry, "timestamp">,
): void {
  const record: MissingContentEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  missingContentLog.push(record);

  if (process.env.NODE_ENV === "development") {
    const location = entry.questionNumber
      ? `${entry.domainSlug}:q${entry.questionNumber}`
      : entry.domainSlug;

    console.warn(
      `[missing-content] fallback activated for "${entry.field}" (${location}, level=${entry.level})`,
    );
  }
}

export function getMissingContentLog(): readonly MissingContentEntry[] {
  return missingContentLog;
}

export function clearMissingContentLog(): void {
  missingContentLog.length = 0;
}
