/**
 * Sales funnel integration — real PostgreSQL required.
 * Covers create, prefill from assessment, update, snapshot, and access control.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  finishAssessment,
  getAssessmentQuestions,
  saveAnswers,
  startAssessment,
  updateBusinessMetrics,
} from "@/modules/assessment/assessment.service";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";
import {
  captureSnapshot,
  createFunnel,
  getFunnel,
  listUserFunnels,
  updateFunnel,
} from "@/modules/sales-funnel/sales-funnel.service";

const RUN_ID = Date.now();

const PREFILL_METRICS = {
  monthlyLeads: 1000,
  monthlyRevenue: 100_000,
  averageOrderValue: 500,
  repeatPurchaseRate: 1.2,
} as const;

async function createTestUser(suffix: number) {
  return db.user.create({
    data: {
      name: `Funnel Tester ${suffix}`,
      email: `funnel-${RUN_ID}-${suffix}@example.com`,
      phone: `0916${String(RUN_ID + suffix).slice(-7)}`,
      phoneVerifiedAt: new Date(),
    },
  });
}

function startPayload(userId: string, suffix: number) {
  return {
    user: {
      name: `Funnel Tester ${suffix}`,
      email: `funnel-${RUN_ID}-${suffix}@example.com`,
    },
    organization: {
      businessName: `Funnel Co ${suffix}`,
      industry: "technology",
      teamSize: "1-5",
      salesModel: "online" as const,
    },
    context: { userId },
  };
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

async function completeAssessmentForUser(suffix: number) {
  const user = await createTestUser(suffix);
  const { context, ...payload } = startPayload(user.id, suffix);
  const start = await startAssessment(payload, context);
  const questions = await getAssessmentQuestions(start.assessmentId);
  await saveAnswers(start.assessmentId, { answers: buildAllAnswers(questions) });
  await finishAssessment(start.assessmentId);
  await updateBusinessMetrics(start.assessmentId, { ...PREFILL_METRICS });
  return { user, assessmentId: start.assessmentId };
}

describe("sales funnel (integration)", () => {
  beforeAll(() => {
    process.env.SALES_FUNNEL_ENABLED = "true";
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("create → prefill from assessment → update → snapshot", async () => {
    const { user, assessmentId } = await completeAssessmentForUser(1);

    const funnel = await createFunnel(
      { userId: user.id },
      {
        name: "Prefilled Funnel",
        prefillFromAssessment: true,
      },
    );

    expect(funnel.userId).toBe(user.id);
    expect(funnel.assessmentSessionId).toBe(assessmentId);
    expect(funnel.salesModel).toBe("online");
    expect(funnel.averageOrderValue).toBe(PREFILL_METRICS.averageOrderValue);
    expect(funnel.repeatPurchaseRate).toBe(PREFILL_METRICS.repeatPurchaseRate);
    expect(funnel.stages).toHaveLength(4);
    expect(funnel.stages[0]?.name).toBe("ترافیک/بازدید");
    expect(funnel.stages[0]?.count).toBe(PREFILL_METRICS.monthlyLeads);
    expect(funnel.stages.at(-1)?.count).toBe(
      Math.round(
        PREFILL_METRICS.monthlyRevenue /
          PREFILL_METRICS.averageOrderValue /
          PREFILL_METRICS.repeatPurchaseRate,
      ),
    );
    expect(funnel.analysis).not.toBeNull();
    expect(funnel.shareToken.length).toBeGreaterThan(10);

    const updated = await updateFunnel(
      funnel.id,
      {
        name: "Updated Funnel",
        stages: [
          { name: "A", count: 500 },
          { name: "B", count: 250 },
          { name: "C", count: 100 },
          { name: "D", count: 50 },
        ],
      },
      { userSession: { userId: user.id } },
    );

    expect(updated.name).toBe("Updated Funnel");
    expect(updated.stages).toHaveLength(4);
    expect(updated.stages[0]?.count).toBe(500);
    expect(updated.stages.at(-1)?.count).toBe(50);
    expect(updated.analysis?.overallConversionRate).toBeCloseTo(0.1, 5);

    const snapshot = await captureSnapshot(funnel.id, {
      userSession: { userId: user.id },
    });

    expect(snapshot.funnelId).toBe(funnel.id);
    expect(snapshot.data.overallConversionRate).toBeCloseTo(0.1, 5);

    const storedSnapshot = await db.salesFunnelSnapshot.findUnique({
      where: { id: snapshot.id },
    });
    expect(storedSnapshot?.funnelId).toBe(funnel.id);

    const listed = await listUserFunnels({ userId: user.id });
    expect(listed.some((item) => item.id === funnel.id)).toBe(true);
    expect(listed.find((item) => item.id === funnel.id)?.name).toBe(
      "Updated Funnel",
    );
  }, 120_000);

  it("create without prefill uses default stage templates", async () => {
    const user = await createTestUser(2);

    const funnel = await createFunnel(
      { userId: user.id },
      {
        name: "Manual Funnel",
        salesModel: "phone",
      },
    );

    expect(funnel.assessmentSessionId).toBeNull();
    expect(funnel.stages).toHaveLength(4);
    expect(funnel.stages[0]?.name).toBe("تماس ورودی");
    expect(funnel.stages.every((stage) => stage.count === 0)).toBe(true);
  });

  it("prefill rejects when user has no completed assessment", async () => {
    const user = await createTestUser(3);

    await expect(
      createFunnel(
        { userId: user.id },
        {
          name: "Missing Assessment",
          prefillFromAssessment: true,
        },
      ),
    ).rejects.toMatchObject({
      code: "assessment_not_found",
      status: 404,
    });
  });

  it("access control: owner, share token, staff bypass, other user denied", async () => {
    const { user: owner } = await completeAssessmentForUser(4);
    const otherUser = await createTestUser(5);

    const funnel = await createFunnel(
      { userId: owner.id },
      {
        name: "Access Test Funnel",
        stages: [
          { name: "Top", count: 100 },
          { name: "Bottom", count: 10 },
        ],
      },
    );

    const byOwner = await getFunnel(funnel.id, {
      userSession: { userId: owner.id },
    });
    expect(byOwner.id).toBe(funnel.id);

    const byToken = await getFunnel(funnel.id, {
      token: funnel.shareToken,
    });
    expect(byToken.shareToken).toBe(funnel.shareToken);

    const byAdmin = await getFunnel(funnel.id, {
      adminSession: { role: "admin" },
    });
    expect(byAdmin.id).toBe(funnel.id);

    const bySalesExpert = await getFunnel(funnel.id, {
      salesExpertSession: { role: "sales_expert" },
    });
    expect(bySalesExpert.id).toBe(funnel.id);

    await expect(
      getFunnel(funnel.id, { userSession: { userId: otherUser.id } }),
    ).rejects.toMatchObject({
      code: "funnel_access_denied",
      status: 403,
    });

    await expect(
      updateFunnel(
        funnel.id,
        { name: "Blocked Update" },
        { userSession: { userId: otherUser.id } },
      ),
    ).rejects.toMatchObject({
      code: "funnel_access_denied",
      status: 403,
    });

    const snapshotByToken = await captureSnapshot(funnel.id, {
      token: funnel.shareToken,
    });
    expect(snapshotByToken.funnelId).toBe(funnel.id);
  }, 120_000);

  it("rejects create when SALES_FUNNEL_ENABLED is false", async () => {
    process.env.SALES_FUNNEL_ENABLED = "false";
    try {
      const user = await createTestUser(6);

      await expect(
        createFunnel({ userId: user.id }, { name: "Disabled Funnel" }),
      ).rejects.toMatchObject({
        code: "sales_funnel_disabled",
        status: 404,
      });
    } finally {
      process.env.SALES_FUNNEL_ENABLED = "true";
    }
  });
});
