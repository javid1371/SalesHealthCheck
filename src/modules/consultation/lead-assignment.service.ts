import { createSmsSenderFromSettings } from "@/modules/auth/sms/kavenegar";
import { findAssessmentById } from "@/modules/assessment/assessment.repository";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";
import { computeLeadScore } from "@/modules/report/expert-view";
import { parseReportSpec } from "@/modules/report/report-spec.service";
import type { ExpertViewSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";
import {
  assignLeadToExpertIfUnassigned,
  clearAssignScheduledFor,
  createConsultationRequest,
  findConsultationRequestByAssessmentSessionId,
  findConsultationRequestById,
  findDueSystemLeadsForAssignment,
  updateLeadPurchaseProbability,
  upgradeConsultationRequestToDirect,
  upgradeConsultationRequestToMessenger,
} from "./consultation.repository";
import {
  computePurchaseProbability,
  isHotLead,
} from "./lead-insights";
import { getLeadSettings } from "./lead-config.service";
import { pickNextSalesExpert } from "@/modules/staff/staff.repository";

export type FinalizeNewLeadMode = "immediate" | "probabilityOnly";

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
  const settings = await getLeadSettings();
  if (!settings.autoAssignEnabled) {
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
    await sender.sendMessage(expert.phone, settings.expertNewLeadSms);
  } catch (error) {
    console.error("[lead-assignment] failed to notify expert via SMS:", error);
  }
}

export async function finalizeNewLead(
  leadId: string,
  options?: {
    assessmentSessionId?: string | null;
    mode?: FinalizeNewLeadMode;
  },
): Promise<void> {
  const mode = options?.mode ?? "immediate";

  try {
    await enrichLeadWithPurchaseProbability(
      leadId,
      options?.assessmentSessionId,
    );
    const settings = await getLeadSettings();
    if (mode === "immediate" && settings.autoAssignEnabled) {
      await autoAssignAndNotifyLead(leadId);
    }
  } catch (error) {
    console.error("[lead-assignment] finalizeNewLead failed:", error);
  }
}

export function runFinalizeNewLead(
  leadId: string,
  options?: {
    assessmentSessionId?: string | null;
    mode?: FinalizeNewLeadMode;
  },
): void {
  void finalizeNewLead(leadId, options).catch((error) => {
    console.error("[lead-assignment] runFinalizeNewLead failed:", error);
  });
}

function computeSystemAssignScheduledFor(delayHours: number): Date {
  const delayMs = delayHours * 60 * 60 * 1000;
  return new Date(Date.now() + delayMs);
}

export async function upgradeExistingLeadToDirect(
  leadId: string,
  input: CreateConsultationRequestInput,
): Promise<{ id: string; createdAt: Date }> {
  const updated = await upgradeConsultationRequestToDirect(leadId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    reportId: input.reportId,
  });

  await finalizeNewLead(updated.id, {
    assessmentSessionId: input.assessmentSessionId,
    mode: "immediate",
  });

  return { id: updated.id, createdAt: updated.createdAt };
}

export async function upgradeExistingLeadToMessenger(
  leadId: string,
  input: CreateConsultationRequestInput,
): Promise<{ id: string; createdAt: Date }> {
  const updated = await upgradeConsultationRequestToMessenger(leadId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    reportId: input.reportId,
  });

  await finalizeNewLead(updated.id, {
    assessmentSessionId: input.assessmentSessionId,
    mode: "immediate",
  });

  return { id: updated.id, createdAt: updated.createdAt };
}

export async function createSystemLeadIfEligible(input: {
  assessmentSessionId: string;
  reportId: string;
  leadScore?: ExpertViewSpec["leadScore"];
  structuredDiagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): Promise<void> {
  const settings = await getLeadSettings();
  if (!settings.autoAssignEnabled) {
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

  if (!leadScore || !isHotLead(leadScore)) {
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

  await createConsultationRequest({
    name: assessment.user.name?.trim() || assessment.organization.businessName,
    phone: assessment.user.phone ?? undefined,
    email: assessment.user.email ?? undefined,
    assessmentSessionId: input.assessmentSessionId,
    reportId: input.reportId,
    source: "system",
    purchaseProbabilityPercent: probability.percent,
    purchaseProbabilityBand: probability.band,
    assignScheduledFor: computeSystemAssignScheduledFor(
      settings.systemAssignDelayHours,
    ),
  });
}

export async function processDueSystemLeadAssignments(): Promise<number> {
  const settings = await getLeadSettings();
  if (!settings.autoAssignEnabled) {
    return 0;
  }

  const dueLeads = await findDueSystemLeadsForAssignment(new Date());
  let processed = 0;

  for (const lead of dueLeads) {
    await autoAssignAndNotifyLead(lead.id);
    await clearAssignScheduledFor(lead.id);
    processed += 1;
  }

  return processed;
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
