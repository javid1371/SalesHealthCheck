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

  it("creates system lead for hot completed assessments without immediate assign", async () => {
    await createStaffUserByAdmin({
      name: "System Lead Expert",
      phone: phoneFor(230),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const { start } = await createCompletedAssessment(231);

    const leads = await db.consultationRequest.findMany({
      where: { assessmentSessionId: start.assessmentId },
    });

    const systemLead = leads.find((lead) => lead.source === "system");
    expect(systemLead).toBeDefined();
    expect(systemLead?.assignedToId).toBeNull();
    expect(systemLead?.assignScheduledFor).not.toBeNull();
    expect(systemLead?.purchaseProbabilityPercent).not.toBeNull();
  }, 120_000);

  it("upgrades system lead to direct on consultation submit without duplicate", async () => {
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
    expect(leadsAfter[0]?.assignedToId).not.toBeNull();
    expect(leadsAfter[0]?.assignScheduledFor).toBeNull();
  }, 120_000);
});
