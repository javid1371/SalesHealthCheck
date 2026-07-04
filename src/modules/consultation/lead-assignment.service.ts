import { env } from "@/lib/env";
import { createSmsSenderFromSettings } from "@/modules/auth/sms/kavenegar";
import { findAssessmentById } from "@/modules/assessment/assessment.repository";
import { computeLeadScore } from "@/modules/report/expert-view";
import { parseReportSpec } from "@/modules/report/report-spec.service";
import type { ExpertViewSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";
import {
  assignLeadToExpertIfUnassigned,
  createConsultationRequest,
  findConsultationRequestByAssessmentSessionId,
  findConsultationRequestById,
  updateLeadPurchaseProbability,
} from "./consultation.repository";
import {
  computePurchaseProbability,
  isNearHotLead,
} from "./lead-insights";
import { pickNextSalesExpert } from "@/modules/staff/staff.repository";

const EXPERT_NEW_LEAD_SMS = "لید جدید داری\nچک کن";

export function resolveLeadScoreFromAssessment(input: {
  reportSpec: unknown;
  structuredDiagnosis: StructuredDiagnosis | null | undefined;
  valueAtStake: ValueAtStakeSpec | null | undefined;
}): ExpertViewSpec["leadScore"] | null {
  const parsed = parseReportSpec(input.reportSpec);
  if (parsed?.expertView?.leadScore) {
    return parsed.expertView.leadScore;
  }

  if (!input.structuredDiagnosis) {
    return null;
  }

  return computeLeadScore(
    input.structuredDiagnosis,
    input.valueAtStake ?? null,
  );
}

async function enrichLeadWithPurchaseProbability(
  leadId: string,
  assessmentSessionId: string | null | undefined,
): Promise<void> {
  if (!assessmentSessionId) {
    return;
  }

  const assessment = await findAssessmentById(assessmentSessionId);
  if (!assessment) {
    return;
  }

  const structuredDiagnosis =
    (assessment.structuredDiagnosis as StructuredDiagnosis | null) ?? null;
  const reportSpec = assessment.report?.reportSpec;
  const valueAtStake = parseReportSpec(reportSpec)?.valueAtStake ?? null;

  const leadScore = resolveLeadScoreFromAssessment({
    reportSpec,
    structuredDiagnosis,
    valueAtStake,
  });

  if (!leadScore) {
    return;
  }

  const probability = computePurchaseProbability({
    leadScore,
    diagnosis: structuredDiagnosis,
    valueAtStake,
  });

  await updateLeadPurchaseProbability(leadId, {
    purchaseProbabilityPercent: probability.percent,
    purchaseProbabilityBand: probability.band,
  });
}

export async function autoAssignAndNotifyLead(leadId: string): Promise<void> {
  if (!env.leadAutoAssignEnabled) {
    return;
  }

  const lead = await findConsultationRequestById(leadId);
  if (!lead || lead.assignedToId) {
    return;
  }

  const expert = await pickNextSalesExpert();
  if (!expert) {
    console.warn("[lead-assignment] no active sales expert with phone found");
    return;
  }

  const assigned = await assignLeadToExpertIfUnassigned(leadId, expert.id);
  if (!assigned) {
    return;
  }

  try {
    const sender = await createSmsSenderFromSettings();
    await sender.sendMessage(expert.phone, EXPERT_NEW_LEAD_SMS);
  } catch (error) {
    console.error("[lead-assignment] failed to notify expert via SMS:", error);
  }
}

export async function finalizeNewLead(
  leadId: string,
  options?: { assessmentSessionId?: string | null },
): Promise<void> {
  if (!env.leadAutoAssignEnabled) {
    return;
  }

  try {
    await enrichLeadWithPurchaseProbability(
      leadId,
      options?.assessmentSessionId,
    );
    await autoAssignAndNotifyLead(leadId);
  } catch (error) {
    console.error("[lead-assignment] finalizeNewLead failed:", error);
  }
}

export function runFinalizeNewLead(
  leadId: string,
  options?: { assessmentSessionId?: string | null },
): void {
  void finalizeNewLead(leadId, options).catch((error) => {
    console.error("[lead-assignment] runFinalizeNewLead failed:", error);
  });
}

export async function createSystemLeadIfEligible(input: {
  assessmentSessionId: string;
  reportId: string;
  leadScore?: ExpertViewSpec["leadScore"];
  structuredDiagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): Promise<void> {
  if (!env.leadAutoAssignEnabled) {
    return;
  }

  const leadScore =
    input.leadScore ??
    (input.structuredDiagnosis
      ? computeLeadScore(
          input.structuredDiagnosis,
          input.valueAtStake ?? null,
        )
      : null);

  if (!leadScore || !isNearHotLead(leadScore)) {
    return;
  }

  const existing = await findConsultationRequestByAssessmentSessionId(
    input.assessmentSessionId,
  );
  if (existing) {
    return;
  }

  const assessment = await findAssessmentById(input.assessmentSessionId);
  if (!assessment) {
    return;
  }

  const probability = computePurchaseProbability({
    leadScore,
    diagnosis: input.structuredDiagnosis ?? null,
    valueAtStake: input.valueAtStake ?? null,
  });

  const lead = await createConsultationRequest({
    name: assessment.user.name?.trim() || assessment.organization.businessName,
    phone: assessment.user.phone ?? undefined,
    email: assessment.user.email ?? undefined,
    assessmentSessionId: input.assessmentSessionId,
    reportId: input.reportId,
    source: "system",
    purchaseProbabilityPercent: probability.percent,
    purchaseProbabilityBand: probability.band,
  });

  await autoAssignAndNotifyLead(lead.id);
}

export function hookSystemLeadDetection(input: {
  assessmentSessionId: string;
  reportId: string;
  leadScore?: ExpertViewSpec["leadScore"];
  structuredDiagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): void {
  void createSystemLeadIfEligible(input).catch((error) => {
    console.error("[lead-assignment] system lead detection failed:", error);
  });
}
