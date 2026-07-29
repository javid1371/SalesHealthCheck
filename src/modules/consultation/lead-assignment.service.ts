import { createSmsSenderFromSettings } from "@/modules/auth/sms/kavenegar";
import { findAssessmentById } from "@/modules/assessment/assessment.repository";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";
import { computeLeadScore } from "@/modules/report/expert-view";
import { parseReportSpec } from "@/modules/report/report-spec.service";
import type { ExpertViewSpec } from "@/types/report-spec";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { ValueAtStakeSpec } from "@/types/value-at-stake";
import {
  ASSESSMENT_PIPELINE_STATUSES,
  assignLeadToExpertIfUnassigned,
  attachReportToLeadIfMissing,
  clearAssignScheduledFor,
  createConsultationRequest,
  createLeadActivity,
  findAssessmentInProgressLeadsForStaleCheck,
  findConsultationRequestByAssessmentSessionId,
  findConsultationRequestById,
  findConsultationRequestByUserId,
  findDueSystemLeadsForAssignment,
  findUnassignedOpenLeadsForAssignment,
  transitionLeadToAssessmentCompleted,
  transitionLeadToAssessmentIncomplete,
  updateLeadAssessmentBinding,
  updateLeadPurchaseProbability,
  upgradeConsultationRequestToDirect,
  upgradeConsultationRequestToMessenger,
} from "./consultation.repository";
import { computePurchaseProbability } from "./lead-insights";
import {
  DEFAULT_EXPERT_NEW_LEAD_SMS,
  getLeadSettings,
} from "./lead-config.service";
import {
  buildExpertLeadDetailUrl,
  EXPERT_NEW_LEAD_SMS_MAX_LENGTH,
  renderExpertNewLeadSms,
  type ExpertNewLeadSmsLead,
} from "./expert-new-lead-sms";
import { serializeAssignmentChangeDetail } from "./lead-activity";
import {
  findStaffUserById,
  pickNextSalesExpert,
} from "@/modules/staff/staff.repository";

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
  overrides?: {
    leadScore?: ExpertViewSpec["leadScore"] | null;
    structuredDiagnosis?: StructuredDiagnosis | null;
    valueAtStake?: ValueAtStakeSpec | null;
  },
): Promise<void> {
  let leadScore = overrides?.leadScore ?? null;
  let structuredDiagnosis = overrides?.structuredDiagnosis ?? null;
  let valueAtStake = overrides?.valueAtStake ?? null;

  if (!leadScore && assessmentSessionId) {
    const assessment = await findAssessmentById(assessmentSessionId);
    if (!assessment) {
      return;
    }

    structuredDiagnosis =
      structuredDiagnosis ??
      ((assessment.structuredDiagnosis as StructuredDiagnosis | null) ?? null);
    const reportSpec = assessment.report?.reportSpec;
    valueAtStake =
      valueAtStake ?? parseReportSpec(reportSpec)?.valueAtStake ?? null;

    leadScore = resolveLeadScoreFromAssessment({
      reportSpec,
      structuredDiagnosis,
      valueAtStake,
    });
  } else if (
    leadScore &&
    !structuredDiagnosis &&
    !valueAtStake &&
    assessmentSessionId
  ) {
    // Keep caller-provided score; still load diagnosis/value if omitted.
    const assessment = await findAssessmentById(assessmentSessionId);
    if (assessment) {
      structuredDiagnosis =
        (assessment.structuredDiagnosis as StructuredDiagnosis | null) ?? null;
      valueAtStake =
        parseReportSpec(assessment.report?.reportSpec)?.valueAtStake ?? null;
    }
  }

  if (!leadScore) {
    return;
  }

  const probability = computePurchaseProbability({
    leadScore,
    diagnosis: structuredDiagnosis ?? null,
    valueAtStake: valueAtStake ?? null,
  });

  await updateLeadPurchaseProbability(leadId, {
    purchaseProbabilityPercent: probability.percent,
    purchaseProbabilityBand: probability.band,
  });
}

async function recordSystemStatusChange(
  leadId: string,
  fromStatus: string,
  toStatus: string,
): Promise<void> {
  await createLeadActivity({
    consultationRequestId: leadId,
    staffUserId: null,
    type: "status_change",
    detail: `${fromStatus}→${toStatus}`,
  });
}

export type AssignLeadOptions = {
  notifyExpert?: boolean;
};

function toExpertNewLeadSmsLead(lead: {
  id: string;
  name: string;
  phone?: string | null;
  purchaseProbabilityPercent?: number | null;
  purchaseProbabilityBand?: ExpertNewLeadSmsLead["purchaseProbabilityBand"];
  adminProbabilityOverridePercent?: number | null;
}): ExpertNewLeadSmsLead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    purchaseProbabilityPercent: lead.purchaseProbabilityPercent,
    purchaseProbabilityBand: lead.purchaseProbabilityBand,
    adminProbabilityOverridePercent: lead.adminProbabilityOverridePercent,
  };
}

async function sendExpertNewLeadSms(
  expertPhone: string,
  lead: ExpertNewLeadSmsLead,
): Promise<void> {
  const settings = await getLeadSettings();
  let body = renderExpertNewLeadSms(settings.expertNewLeadSms, lead);
  if (body.length > EXPERT_NEW_LEAD_SMS_MAX_LENGTH) {
    console.warn(
      "[lead-assignment] expert SMS exceeds max length after interpolate; falling back to default body",
      { leadId: lead.id, length: body.length },
    );
    body = DEFAULT_EXPERT_NEW_LEAD_SMS;
  }

  try {
    const sender = await createSmsSenderFromSettings();
    await sender.sendMessage(expertPhone, body);
  } catch (error) {
    console.error("[lead-assignment] failed to notify expert via SMS:", error);
  }
}

export async function notifyAssignedExpertOfLead(leadId: string): Promise<void> {
  const lead = await findConsultationRequestById(leadId);
  if (!lead?.assignedToId) {
    return;
  }

  const expert = await findStaffUserById(lead.assignedToId);
  if (!expert?.phone) {
    console.warn(
      "[lead-assignment] assigned expert missing phone; skip SMS",
      lead.assignedToId,
    );
    return;
  }

  await sendExpertNewLeadSms(expert.phone, toExpertNewLeadSmsLead(lead));
}

export function renderLeadTransferSms(input: {
  leadId: string;
  leadName: string;
  fromName: string;
}): string {
  const detailUrl = buildExpertLeadDetailUrl(input.leadId);
  return `سرنخ «${input.leadName.trim()}» به شما منتقل شد (از ${input.fromName.trim()}).\n${detailUrl}`;
}

export async function notifyLeadTransferToExpert(input: {
  leadId: string;
  leadName: string;
  toStaffUserId: string;
  fromName: string;
}): Promise<void> {
  const expert = await findStaffUserById(input.toStaffUserId);
  if (!expert?.phone) {
    console.warn(
      "[lead-assignment] transfer recipient missing phone; skip SMS",
      input.toStaffUserId,
    );
    return;
  }

  const body = renderLeadTransferSms({
    leadId: input.leadId,
    leadName: input.leadName,
    fromName: input.fromName,
  });

  try {
    const sender = await createSmsSenderFromSettings();
    await sender.sendMessage(expert.phone, body);
  } catch (error) {
    console.error("[lead-assignment] failed to notify transfer via SMS:", error);
  }
}

function resolvePreferStaffIdForLead(input: {
  purchaseProbabilityBand: string | null | undefined;
  source: "direct" | "system" | "messenger";
  hotLeadDirectAssigneeId: string | null;
  preferAssigneeBySource: Partial<
    Record<"messenger" | "direct" | "system", string>
  >;
}): string | null {
  // Hot-lead assignee wins over source prefer when set.
  if (
    input.purchaseProbabilityBand === "high" &&
    input.hotLeadDirectAssigneeId
  ) {
    return input.hotLeadDirectAssigneeId;
  }

  return input.preferAssigneeBySource[input.source] ?? null;
}

export async function autoAssignAndNotifyLead(
  leadId: string,
  options?: AssignLeadOptions,
): Promise<void> {
  const settings = await getLeadSettings();
  if (!settings.autoAssignEnabled) {
    return;
  }

  const lead = await findConsultationRequestById(leadId);
  if (!lead) {
    return;
  }

  if (lead.assignedToId) {
    return;
  }

  if (
    settings.routingRules.excludeSourcesFromAutoAssign.includes(lead.source)
  ) {
    return;
  }

  const expert = await pickNextSalesExpert({
    excludeIds: settings.autoAssignExcludeStaffIds,
    maxOpenLeadsPerExpert: settings.maxOpenLeadsPerExpert,
    preferStaffId: resolvePreferStaffIdForLead({
      purchaseProbabilityBand: lead.purchaseProbabilityBand,
      source: lead.source,
      hotLeadDirectAssigneeId: settings.hotLeadDirectAssigneeId,
      preferAssigneeBySource: settings.routingRules.preferAssigneeBySource,
    }),
  });
  if (!expert) {
    console.warn("[lead-assignment] no active sales expert with phone found");
    return;
  }

  const assigned = await assignLeadToExpertIfUnassigned(leadId, expert.id);
  if (!assigned) {
    return;
  }

  await createLeadActivity({
    consultationRequestId: leadId,
    staffUserId: null,
    type: "assignment_change",
    detail: serializeAssignmentChangeDetail({
      fromId: null,
      toId: expert.id,
      fromName: null,
      toName: expert.name,
    }),
  });

  if (options?.notifyExpert === false) {
    return;
  }

  await sendExpertNewLeadSms(expert.phone, toExpertNewLeadSmsLead(lead));
}

export type FinalizeNewLeadOptions = {
  assessmentSessionId?: string | null;
  mode?: FinalizeNewLeadMode;
  notifyExpert?: boolean;
};

export async function finalizeNewLead(
  leadId: string,
  options?: FinalizeNewLeadOptions,
): Promise<void> {
  const mode = options?.mode ?? "immediate";

  try {
    await enrichLeadWithPurchaseProbability(
      leadId,
      options?.assessmentSessionId,
    );
    const settings = await getLeadSettings();
    if (mode === "immediate" && settings.autoAssignEnabled) {
      await autoAssignAndNotifyLead(leadId, {
        notifyExpert: options?.notifyExpert,
      });
    }
  } catch (error) {
    console.error("[lead-assignment] finalizeNewLead failed:", error);
  }
}

export function runFinalizeNewLead(
  leadId: string,
  options?: FinalizeNewLeadOptions,
): void {
  void finalizeNewLead(leadId, options).catch((error) => {
    console.error("[lead-assignment] runFinalizeNewLead failed:", error);
  });
}

async function finalizeConsultationUpgrade(
  leadId: string,
  assessmentSessionId: string | null | undefined,
  previousStatus: string | null | undefined,
  nextStatus: string,
): Promise<void> {
  if (
    previousStatus &&
    previousStatus !== nextStatus &&
    ASSESSMENT_PIPELINE_STATUSES.includes(
      previousStatus as (typeof ASSESSMENT_PIPELINE_STATUSES)[number],
    )
  ) {
    await recordSystemStatusChange(leadId, previousStatus, nextStatus);
  }

  await enrichLeadWithPurchaseProbability(leadId, assessmentSessionId);

  const lead = await findConsultationRequestById(leadId);
  if (!lead) {
    return;
  }

  const settings = await getLeadSettings();
  if (!lead.assignedToId) {
    if (settings.autoAssignEnabled) {
      await autoAssignAndNotifyLead(leadId, { notifyExpert: true });
    }
    return;
  }

  // Consultation request: always notify the assigned expert (even if soft-assigned at start).
  await notifyAssignedExpertOfLead(leadId);
}

export async function upgradeExistingLeadToDirect(
  leadId: string,
  input: CreateConsultationRequestInput,
): Promise<{ id: string; createdAt: Date }> {
  const before = await findConsultationRequestById(leadId);
  const updated = await upgradeConsultationRequestToDirect(leadId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    reportId: input.reportId,
  });

  await finalizeConsultationUpgrade(
    updated.id,
    input.assessmentSessionId,
    before?.status,
    updated.status,
  );

  return { id: updated.id, createdAt: updated.createdAt };
}

export async function upgradeExistingLeadToMessenger(
  leadId: string,
  input: CreateConsultationRequestInput,
): Promise<{ id: string; createdAt: Date }> {
  const before = await findConsultationRequestById(leadId);
  const updated = await upgradeConsultationRequestToMessenger(leadId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    reportId: input.reportId,
  });

  await finalizeConsultationUpgrade(
    updated.id,
    input.assessmentSessionId,
    before?.status,
    updated.status,
  );

  return { id: updated.id, createdAt: updated.createdAt };
}

async function findLeadForAssessmentUser(assessmentSessionId: string) {
  const bySession =
    await findConsultationRequestByAssessmentSessionId(assessmentSessionId);
  if (bySession) {
    return bySession;
  }

  const assessment = await findAssessmentById(assessmentSessionId);
  if (!assessment) {
    return null;
  }

  return findConsultationRequestByUserId(assessment.userId);
}

/**
 * Soft-assign a system lead when an assessment starts.
 * One lead per person: reuses the user's existing lead when present.
 * Creates/updates status=assessment_in_progress and assigns round-robin without
 * expert SMS (experts must not call while the user is mid-test).
 */
export async function createLeadOnAssessmentStart(input: {
  assessmentSessionId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<void> {
  const settings = await getLeadSettings();
  if (!settings.createLeadOnAssessmentStart) {
    return;
  }

  const existing = await findLeadForAssessmentUser(input.assessmentSessionId);
  const name = input.name.trim() || "کاربر";

  if (existing) {
    // CRM statuses (consultation request / contacted / …) must not regress.
    if (
      !ASSESSMENT_PIPELINE_STATUSES.includes(
        existing.status as (typeof ASSESSMENT_PIPELINE_STATUSES)[number],
      )
    ) {
      await updateLeadAssessmentBinding(existing.id, {
        assessmentSessionId: input.assessmentSessionId,
        name,
        phone: input.phone,
        email: input.email,
      });
      return;
    }

    await updateLeadAssessmentBinding(existing.id, {
      assessmentSessionId: input.assessmentSessionId,
      status: "assessment_in_progress",
      name,
      phone: input.phone,
      email: input.email,
    });

    if (!existing.assignedToId) {
      await finalizeNewLead(existing.id, {
        assessmentSessionId: input.assessmentSessionId,
        mode: "immediate",
        notifyExpert: false,
      });
    }
    return;
  }

  if (settings.pauseSystemLeadCreation) {
    return;
  }

  const lead = await createConsultationRequest({
    name,
    phone: input.phone ?? undefined,
    email: input.email ?? undefined,
    assessmentSessionId: input.assessmentSessionId,
    source: "system",
    status: "assessment_in_progress",
  });

  await createLeadActivity({
    consultationRequestId: lead.id,
    staffUserId: null,
    type: "created",
    detail: "assessment_start",
  });

  await finalizeNewLead(lead.id, {
    assessmentSessionId: input.assessmentSessionId,
    mode: "immediate",
    notifyExpert: false,
  });
}

export function hookLeadOnAssessmentStart(input: {
  assessmentSessionId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}): void {
  void createLeadOnAssessmentStart(input).catch((error) => {
    console.error("[lead-assignment] createLeadOnAssessmentStart failed:", error);
  });
}

/**
 * On assessment finish: move the session lead to assessment_completed (when still
 * in the assessment pipeline) and enrich purchase probability. No longer creates
 * hot-only delayed system leads.
 */
export async function transitionLeadOnAssessmentComplete(input: {
  assessmentSessionId: string;
  reportId: string;
  leadScore?: ExpertViewSpec["leadScore"];
  structuredDiagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): Promise<void> {
  const existing = await findLeadForAssessmentUser(input.assessmentSessionId);

  if (!existing) {
    const settings = await getLeadSettings();
    if (settings.pauseSystemLeadCreation) {
      return;
    }

    const assessment = await findAssessmentById(input.assessmentSessionId);
    if (!assessment) {
      return;
    }

    const lead = await createConsultationRequest({
      name:
        assessment.user.name?.trim() || assessment.organization.businessName,
      phone: assessment.user.phone ?? undefined,
      email: assessment.user.email ?? undefined,
      assessmentSessionId: input.assessmentSessionId,
      reportId: input.reportId,
      source: "system",
      status: "assessment_completed",
    });

    await finalizeNewLead(lead.id, {
      assessmentSessionId: input.assessmentSessionId,
      mode: "immediate",
      notifyExpert: false,
    });
    return;
  }

  await updateLeadAssessmentBinding(existing.id, {
    assessmentSessionId: input.assessmentSessionId,
    reportId: input.reportId,
  });

  const { transitioned, fromStatus } =
    await transitionLeadToAssessmentCompleted(existing.id, input.reportId);

  if (transitioned && fromStatus) {
    await recordSystemStatusChange(
      existing.id,
      fromStatus,
      "assessment_completed",
    );
  } else {
    await attachReportToLeadIfMissing(existing.id, input.reportId);
  }

  const leadScore =
    input.leadScore ??
    (input.structuredDiagnosis
      ? computeLeadScore(
          input.structuredDiagnosis,
          input.valueAtStake ?? null,
        )
      : null);

  await enrichLeadWithPurchaseProbability(
    existing.id,
    input.assessmentSessionId,
    {
      leadScore,
      structuredDiagnosis: input.structuredDiagnosis ?? null,
      valueAtStake: input.valueAtStake ?? null,
    },
  );
}

/** @deprecated Use transitionLeadOnAssessmentComplete — kept for call-site clarity. */
export async function createSystemLeadIfEligible(input: {
  assessmentSessionId: string;
  reportId: string;
  leadScore?: ExpertViewSpec["leadScore"];
  structuredDiagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): Promise<void> {
  await transitionLeadOnAssessmentComplete(input);
}

export async function markAssessmentLeadIncomplete(
  assessmentSessionId: string,
): Promise<boolean> {
  const existing = await findLeadForAssessmentUser(assessmentSessionId);
  if (!existing) {
    return false;
  }

  await updateLeadAssessmentBinding(existing.id, {
    assessmentSessionId,
  });

  const { transitioned, fromStatus } =
    await transitionLeadToAssessmentIncomplete(existing.id);

  if (transitioned && fromStatus) {
    await recordSystemStatusChange(
      existing.id,
      fromStatus,
      "assessment_incomplete",
    );
  }

  return transitioned;
}

export function hookLeadOnAssessmentAbandoned(
  assessmentSessionId: string,
): void {
  void markAssessmentLeadIncomplete(assessmentSessionId).catch((error) => {
    console.error(
      "[lead-assignment] markAssessmentLeadIncomplete failed:",
      error,
    );
  });
}

function resolveAssessmentLastActivity(input: {
  updatedAt: Date;
  startedAt: Date;
  answers: { answeredAt: Date }[];
}): Date {
  let latest = input.updatedAt.getTime() > input.startedAt.getTime()
    ? input.updatedAt
    : input.startedAt;

  for (const answer of input.answers) {
    if (answer.answeredAt.getTime() > latest.getTime()) {
      latest = answer.answeredAt;
    }
  }

  return latest;
}

/**
 * Cron: move stale assessment_in_progress leads to assessment_incomplete.
 * Abandoned assessments are moved immediately (no inactivity wait).
 */
export async function processStaleAssessmentLeads(): Promise<number> {
  const settings = await getLeadSettings();
  const staleBefore = new Date(
    Date.now() - settings.assessmentIncompleteAfterHours * 60 * 60 * 1000,
  );

  const candidates = await findAssessmentInProgressLeadsForStaleCheck();
  let processed = 0;

  for (const lead of candidates) {
    const session = lead.assessmentSession;
    if (!session) {
      continue;
    }

    const shouldMove =
      session.status === "abandoned" ||
      ((session.status === "started" || session.status === "in_progress") &&
        resolveAssessmentLastActivity(session) < staleBefore);

    if (!shouldMove) {
      continue;
    }

    const moved = await markAssessmentLeadIncomplete(session.id);
    if (moved) {
      processed += 1;
    }
  }

  return processed;
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

/**
 * Catch-up: assign any open lead still without an expert (round-robin, respecting
 * auto-assign exclusions). Skips expert SMS for mid-assessment soft leads.
 */
export async function processUnassignedLeadAssignments(): Promise<number> {
  const settings = await getLeadSettings();
  if (!settings.autoAssignEnabled) {
    return 0;
  }

  const leads = await findUnassignedOpenLeadsForAssignment();
  let processed = 0;

  for (const lead of leads) {
    const notifyExpert = lead.status !== "assessment_in_progress";
    const before = await findConsultationRequestById(lead.id);
    if (!before || before.assignedToId) {
      continue;
    }

    await autoAssignAndNotifyLead(lead.id, { notifyExpert });
    const after = await findConsultationRequestById(lead.id);
    if (after?.assignedToId) {
      processed += 1;
    }
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
  void transitionLeadOnAssessmentComplete(input).catch((error) => {
    console.error("[lead-assignment] assessment complete transition failed:", error);
  });
}

export function hookLeadOnAssessmentComplete(input: {
  assessmentSessionId: string;
  reportId: string;
  leadScore?: ExpertViewSpec["leadScore"];
  structuredDiagnosis?: StructuredDiagnosis | null;
  valueAtStake?: ValueAtStakeSpec | null;
}): void {
  hookSystemLeadDetection(input);
}
