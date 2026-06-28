import type { DiagnosisConfidence } from "@/types/structured-diagnosis";

/**
 * The 4 business numbers the user provides after the qualitative report
 * (gated input). Symbols match the spec funnel identity:
 *   R0 = L × CR × AOV × F
 *
 * All inputs are optional at the type level because the gate may be skipped;
 * the value-at-stake engine is responsible for rejecting incomplete input
 * (missing R0/AOV/L) and returning `null` instead of a wrong number.
 */
export interface ValueAtStakeInput {
  /** R0 — approximate monthly revenue (base of every calculation) */
  R0: number;
  /** AOV — average order value */
  AOV: number;
  /** L — monthly leads / inbound contacts */
  L: number;
  /** RP — repeat purchase rate / frequency. If absent, F0 = 1 (no repeat). */
  RP?: number;
}

/**
 * Output of the Value-at-Stake engine (M1), consumed by the Composer and
 * surfaced inside `ReportSpec.valueAtStake`.
 *
 * - tier1 is numeric (recoverable potential) with a decomposition and range.
 * - tier2 is qualitative only in v1 (no number, to protect tier1 credibility).
 * - tier3 is a conditional mechanism, never a figure.
 */
export interface ValueAtStakeSpec {
  tier1: {
    monthly: number;
    annual: number;
    range: { low: number; high: number };
    breakdown: {
      conversion: number;
      aov: number;
      repeat: number;
    };
  };
  tier2: { qualitative: string };
  tier3: { mechanism: string; conditions: string[] };
  confidence: DiagnosisConfidence;
}
