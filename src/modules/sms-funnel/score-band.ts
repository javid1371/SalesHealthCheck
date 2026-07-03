import type { ScoreBand } from "@prisma/client";

/** Map overall score percentage to nurture copy band. */
export function resolveScoreBand(percentage: number): ScoreBand {
  if (percentage <= 50) return "low";
  if (percentage <= 75) return "medium";
  return "high";
}
