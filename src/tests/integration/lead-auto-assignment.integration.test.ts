/**
 * Auto lead assignment integration — real PostgreSQL required.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password-auth";
import {
  listConsultationRequests,
  submitConsultationRequest,
} from "@/modules/consultation/consultation.service";
import { createStaffUserByAdmin } from "@/modules/staff/staff.service";
import {
  finishAssessment,
  getAssessmentQuestions,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";

const RUN_ID = Date.now();

function phoneFor(suffix: number): string {
  return `0917${String(RUN_ID + suffix).slice(-7)}`;
}

function buildAllAnswers(questions: QuestionsForAssessmentDto) {
  const answers: { questionId: string; selectedOptionId: string }[] = [];
  for (const domain of questions.domains) {
    for (const question of domain.questions) {
      const option = question.options[0] ?? question.options[0];
      answers.push({ questionId: question.id, selectedOptionId: option.id });
    }
  }
  return answers;
}

async function waitForAssessmentLead(
  assessmentSessionId: string,
  status?: string,
) {
  let lead = null as Awaited<
    ReturnType<typeof db.consultationRequest.findFirst>
  >;
  for (let i = 0; i < 20; i += 1) {
    lead = await db.consultationRequest.findFirst({
      where: { assessmentSessionId },
    });
    if (lead && (!status || lead.status === status)) {
      return lead;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return lead;
}

async function createCompletedAssessment(index: number) {
  const phone = phoneFor(index);
  const user = await db.user.create({
    data: {
      name: `Auto Assign User ${index}`,
      email: `auto-assign-${RUN_ID}-${index}@example.com`,
      phone,
      phoneVerifiedAt: new Date(),
    },
  });

  const start = await startAssessment(
    {
      user: {
        name: user.name ?? "Tester",
        email: user.email ?? undefined,
      },
      organization: {
        businessName: `Auto Assign Biz ${index}`,
        industry: "technology",
        teamSize: "1-5",
        salesModel: "online",
      },
    },
    { userId: user.id },
  );

  const questions = await getAssessmentQuestions(start.assessmentId);
  await saveAnswers(start.assessmentId, {
    answers: buildAllAnswers(questions),
  });
  const finish = await finishAssessment(start.assessmentId);

  return { start, finish, user };
}

describe("auto lead assignment (integration)", () => {
  beforeEach(() => {
    vi.stubEnv("LEAD_AUTO_ASSIGN_ENABLED", "true");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await db.$disconnect();
  });

  it("auto-assigns direct consultation request to active sales expert", async () => {
    const expertPhone = phoneFor(200);
    const expert = await createStaffUserByAdmin({
      name: "Auto Assign Expert",
      phone: expertPhone,
      password: "ExpertPass123",
      role: "sales_expert",
    });

    await db.staffUser.updateMany({
      where: {
        role: "sales_expert",
        isActive: true,
        id: { not: expert.id },
      },
      data: { lastAssignedAt: new Date() },
    });
    await db.staffUser.update({
      where: { id: expert.id },
      data: { lastAssignedAt: null },
    });

    const { start, finish } = await createCompletedAssessment(201);
    const consultation = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      reportId: finish.reportId,
      token: start.resultToken,
      name: "Direct Lead",
      phone: phoneFor(202),
    });

    const lead = await db.consultationRequest.findUnique({
      where: { id: consultation.id },
    });

    expect(lead?.assignedToId).toBe(expert.id);
    expect(lead?.source).toBe("direct");
    expect(lead?.purchaseProbabilityPercent).not.toBeNull();
    expect(lead?.purchaseProbabilityBand).not.toBeNull();
  }, 120_000);

  it("does not auto-assign when feature flag is disabled", async () => {
    vi.stubEnv("LEAD_AUTO_ASSIGN_ENABLED", "false");

    await createStaffUserByAdmin({
      name: "Disabled Flag Expert",
      phone: phoneFor(210),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const { start, finish } = await createCompletedAssessment(211);
    const consultation = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      reportId: finish.reportId,
      token: start.resultToken,
      name: "Unassigned Lead",
      phone: phoneFor(212),
    });

    const lead = await db.consultationRequest.findUnique({
      where: { id: consultation.id },
    });

    expect(lead?.assignedToId).toBeNull();
  }, 120_000);

  it("exposes source and purchase probability in lead list", async () => {
    const admin = await db.staffUser.create({
      data: {
        name: "Auto Assign Admin",
        phone: phoneFor(220),
        passwordHash: hashPassword("AdminPass123"),
        role: "admin",
      },
    });

    const { start, finish } = await createCompletedAssessment(221);
    const consultation = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      reportId: finish.reportId,
      token: start.resultToken,
      name: "List Lead",
      phone: phoneFor(222),
    });

    const list = await listConsultationRequests(
      { page: 1, pageSize: 50 },
      {
        adminSession: {
          role: "admin",
          staffUserId: admin.id,
          name: admin.name,
        },
        salesExpertSession: null,
      },
    );

    const item = list.requests.find((row) => row.id === consultation.id);
    expect(item?.sourceLabel).toBe("درخواست مستقیم");
    expect(item?.purchaseProbabilityLabel).toMatch(/٪$/);
  }, 120_000);

  it("creates in-progress lead on start and moves to completed on finish", async () => {
    const expert = await createStaffUserByAdmin({
      name: "System Lead Expert",
      phone: phoneFor(230),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    await db.staffUser.updateMany({
      where: {
        role: "sales_expert",
        isActive: true,
        id: { not: expert.id },
      },
      data: { lastAssignedAt: new Date() },
    });
    await db.staffUser.update({
      where: { id: expert.id },
      data: { lastAssignedAt: null },
    });

    const phone = phoneFor(231);
    const user = await db.user.create({
      data: {
        name: "Pipeline User",
        email: `pipeline-${RUN_ID}@example.com`,
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    const start = await startAssessment(
      {
        user: {
          name: user.name ?? "Tester",
          email: user.email ?? undefined,
        },
        organization: {
          businessName: "Pipeline Biz",
          industry: "technology",
          teamSize: "1-5",
          salesModel: "online",
        },
      },
      { userId: user.id },
    );

    const inProgressLead = await waitForAssessmentLead(
      start.assessmentId,
      "assessment_in_progress",
    );

    expect(inProgressLead?.status).toBe("assessment_in_progress");
    expect(inProgressLead?.source).toBe("system");
    expect(inProgressLead?.assignedToId).toBe(expert.id);

    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, {
      answers: buildAllAnswers(questions),
    });
    await finishAssessment(start.assessmentId);

    const completedLead = await db.consultationRequest.findFirst({
      where: { assessmentSessionId: start.assessmentId },
    });
    expect(completedLead?.status).toBe("assessment_completed");
    expect(completedLead?.reportId).not.toBeNull();
    expect(completedLead?.purchaseProbabilityPercent).not.toBeNull();
  }, 120_000);

  it("upgrades completed assessment lead to new on consultation submit", async () => {
    await createStaffUserByAdmin({
      name: "Upgrade Expert",
      phone: phoneFor(240),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const { start, finish } = await createCompletedAssessment(241);

    const systemLeadsBefore = await db.consultationRequest.findMany({
      where: { assessmentSessionId: start.assessmentId },
    });
    const systemLead = systemLeadsBefore.find((lead) => lead.source === "system");
    expect(systemLead).toBeDefined();
    expect(systemLead?.status).toBe("assessment_completed");

    const consultation = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      reportId: finish.reportId,
      token: start.resultToken,
      name: "Upgraded Lead",
      phone: phoneFor(242),
      message: "Direct request",
    });

    expect(consultation.id).toBe(systemLead!.id);

    const leadsAfter = await db.consultationRequest.findMany({
      where: { assessmentSessionId: start.assessmentId },
    });
    expect(leadsAfter).toHaveLength(1);
    expect(leadsAfter[0]?.source).toBe("direct");
    expect(leadsAfter[0]?.status).toBe("new");
    expect(leadsAfter[0]?.assignedToId).not.toBeNull();
    expect(leadsAfter[0]?.assignScheduledFor).toBeNull();
  }, 120_000);

  it("upgrades in-progress assessment lead to new on consultation submit", async () => {
    await createStaffUserByAdmin({
      name: "Mid Test Expert",
      phone: phoneFor(245),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const phone = phoneFor(246);
    const user = await db.user.create({
      data: {
        name: "Mid Test User",
        email: `mid-test-${RUN_ID}@example.com`,
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    const start = await startAssessment(
      {
        user: {
          name: user.name ?? "Tester",
          email: user.email ?? undefined,
        },
        organization: {
          businessName: "Mid Test Biz",
          industry: "technology",
          teamSize: "1-5",
          salesModel: "online",
        },
      },
      { userId: user.id },
    );

    const inProgressLead = await waitForAssessmentLead(
      start.assessmentId,
      "assessment_in_progress",
    );
    expect(inProgressLead).toBeTruthy();

    const consultation = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      token: start.resultToken,
      name: "Mid Test Consult",
      phone: phoneFor(247),
      message: "Need help during assessment",
    });

    expect(consultation.id).toBe(inProgressLead!.id);

    const upgraded = await db.consultationRequest.findUnique({
      where: { id: inProgressLead!.id },
    });
    expect(upgraded?.source).toBe("direct");
    expect(upgraded?.status).toBe("new");
    expect(upgraded?.assignedToId).not.toBeNull();
  }, 120_000);

  it("moves incomplete assessment lead to completed on finish", async () => {
    const { markAssessmentLeadIncomplete } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createStaffUserByAdmin({
      name: "Incomplete Finish Expert",
      phone: phoneFor(248),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const phone = phoneFor(249);
    const user = await db.user.create({
      data: {
        name: "Incomplete Finish User",
        email: `incomplete-finish-${RUN_ID}@example.com`,
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    const start = await startAssessment(
      {
        user: {
          name: user.name ?? "Tester",
          email: user.email ?? undefined,
        },
        organization: {
          businessName: "Incomplete Finish Biz",
          industry: "technology",
          teamSize: "1-5",
          salesModel: "online",
        },
      },
      { userId: user.id },
    );

    const inProgressLead = await waitForAssessmentLead(
      start.assessmentId,
      "assessment_in_progress",
    );
    expect(inProgressLead).toBeTruthy();

    const moved = await markAssessmentLeadIncomplete(start.assessmentId);
    expect(moved).toBe(true);

    const incompleteLead = await db.consultationRequest.findUnique({
      where: { id: inProgressLead!.id },
    });
    expect(incompleteLead?.status).toBe("assessment_incomplete");

    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, {
      answers: buildAllAnswers(questions),
    });
    await finishAssessment(start.assessmentId);

    const completedLead = await db.consultationRequest.findUnique({
      where: { id: inProgressLead!.id },
    });
    expect(completedLead?.status).toBe("assessment_completed");
    expect(completedLead?.reportId).not.toBeNull();
  }, 120_000);

  it("moves stale in-progress assessment leads to incomplete via cron processor", async () => {
    const { processStaleAssessmentLeads } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    const expert = await createStaffUserByAdmin({
      name: "Stale Expert",
      phone: phoneFor(250),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const phone = phoneFor(251);
    const user = await db.user.create({
      data: {
        name: "Stale User",
        email: `stale-${RUN_ID}@example.com`,
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    const start = await startAssessment(
      {
        user: {
          name: user.name ?? "Tester",
          email: user.email ?? undefined,
        },
        organization: {
          businessName: "Stale Biz",
          industry: "technology",
          teamSize: "1-5",
          salesModel: "online",
        },
      },
      { userId: user.id },
    );

    const lead = await waitForAssessmentLead(
      start.assessmentId,
      "assessment_in_progress",
    );
    expect(lead).toBeTruthy();

    const staleAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    // Prisma @updatedAt would overwrite a normal update; force timestamps via SQL.
    await db.$executeRaw`
      UPDATE assessment_sessions
      SET updated_at = ${staleAt}, started_at = ${staleAt}
      WHERE id = ${start.assessmentId}
    `;

    const moved = await processStaleAssessmentLeads();
    expect(moved).toBeGreaterThanOrEqual(1);

    const updated = await db.consultationRequest.findUnique({
      where: { id: lead!.id },
    });
    expect(updated?.status).toBe("assessment_incomplete");
    expect(updated?.assignedToId === expert.id || updated?.assignedToId != null).toBe(
      true,
    );
  }, 120_000);

  it("moves abandoned assessment lead to incomplete without waiting for stale threshold", async () => {
    const { processStaleAssessmentLeads } = await import(
      "@/modules/consultation/lead-assignment.service"
    );

    await createStaffUserByAdmin({
      name: "Abandoned Expert",
      phone: phoneFor(252),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const phone = phoneFor(253);
    const user = await db.user.create({
      data: {
        name: "Abandoned User",
        email: `abandoned-${RUN_ID}@example.com`,
        phone,
        phoneVerifiedAt: new Date(),
      },
    });

    const start = await startAssessment(
      {
        user: {
          name: user.name ?? "Tester",
          email: user.email ?? undefined,
        },
        organization: {
          businessName: "Abandoned Biz",
          industry: "technology",
          teamSize: "1-5",
          salesModel: "online",
        },
      },
      { userId: user.id },
    );

    const lead = await waitForAssessmentLead(
      start.assessmentId,
      "assessment_in_progress",
    );
    expect(lead).toBeTruthy();

    await db.assessmentSession.update({
      where: { id: start.assessmentId },
      data: { status: "abandoned" },
    });

    const moved = await processStaleAssessmentLeads();
    expect(moved).toBeGreaterThanOrEqual(1);

    const updated = await db.consultationRequest.findUnique({
      where: { id: lead!.id },
    });
    expect(updated?.status).toBe("assessment_incomplete");
  }, 120_000);
});


