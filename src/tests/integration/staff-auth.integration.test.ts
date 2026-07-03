/**
 * Staff auth + lead pipeline integration — real PostgreSQL required.
 */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password-auth";
import {
  listConsultationRequests,
  submitConsultationRequest,
  updateConsultationLeadStatus,
} from "@/modules/consultation/consultation.service";
import {
  authenticateStaff,
  createStaffUserByAdmin,
} from "@/modules/staff/staff.service";
import {
  finishAssessment,
  getAssessmentQuestions,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";

const RUN_ID = Date.now();

function phoneFor(suffix: number): string {
  return `0916${String(RUN_ID + suffix).slice(-7)}`;
}

function buildAllAnswers(questions: QuestionsForAssessmentDto) {
  const answers: { questionId: string; selectedOptionId: string }[] = [];
  for (const domain of questions.domains) {
    for (const question of domain.questions) {
      const option = question.options[2] ?? question.options[0];
      answers.push({ questionId: question.id, selectedOptionId: option.id });
    }
  }
  return answers;
}

async function createCompletedAssessment(index: number) {
  const phone = phoneFor(index);
  const user = await db.user.create({
    data: {
      name: `Staff Flow User ${index}`,
      email: `staff-flow-${RUN_ID}-${index}@example.com`,
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
        businessName: `Staff Flow Biz ${index}`,
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

  return { start, finish };
}

describe("staff auth and lead pipeline (integration)", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("admin creates expert → expert logs in → sees assigned lead → closes it", async () => {
    const adminPhone = phoneFor(100);
    const expertPhone = phoneFor(101);
    const expertPassword = "ExpertPass123";

    const admin = await db.staffUser.create({
      data: {
        name: "Flow Admin",
        phone: adminPhone,
        passwordHash: hashPassword("AdminPass123"),
        role: "admin",
      },
    });

    const expert = await createStaffUserByAdmin({
      name: "Flow Expert",
      phone: expertPhone,
      password: expertPassword,
      role: "sales_expert",
    });

    const authenticatedExpert = await authenticateStaff("sales_expert", {
      phone: expertPhone,
      password: expertPassword,
    });

    expect(authenticatedExpert.staffUserId).toBe(expert.id);

    const { start, finish } = await createCompletedAssessment(102);
    const consultation = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      reportId: finish.reportId,
      token: start.resultToken,
      name: "Pipeline Lead",
      phone: phoneFor(103),
    });

    const adminAccess = {
      adminSession: {
        role: "admin" as const,
        staffUserId: admin.id,
        name: admin.name,
      },
      salesExpertSession: null,
    };

    const beforeAssign = await listConsultationRequests(
      { page: 1, pageSize: 50 },
      adminAccess,
    );
    expect(
      beforeAssign.requests.some((item) => item.id === consultation.id),
    ).toBe(true);

    await updateConsultationLeadStatus(
      consultation.id,
      { assignedToId: expert.id },
      adminAccess,
    );

    const expertAccess = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: expert.id,
        name: expert.name,
      },
    };

    const expertList = await listConsultationRequests(
      { page: 1, pageSize: 50 },
      expertAccess,
    );
    expect(expertList.requests.some((item) => item.id === consultation.id)).toBe(
      true,
    );

    const otherExpertAccess = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: "nonexistent-expert-id",
        name: "Other",
      },
    };

    const otherList = await listConsultationRequests(
      { page: 1, pageSize: 50 },
      otherExpertAccess,
    );
    expect(
      otherList.requests.some((item) => item.id === consultation.id),
    ).toBe(false);

    const closed = await updateConsultationLeadStatus(
      consultation.id,
      { status: "closed_won" },
      expertAccess,
    );

    expect(closed.status).toBe("closed_won");
    expect(closed.assignedToId).toBe(expert.id);
  }, 120_000);
});
