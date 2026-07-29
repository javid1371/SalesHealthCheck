/**
 * Async finish + token access integration (ADR 0017).
 * Worker path is exercised inline via runFinishAssessmentCore.
 */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  enqueueFinishAssessment,
  finishAssessment,
  getAssessmentQuestions,
  getFinishJobStatus,
  runFinishAssessmentCore,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";

const RUN_ID = Date.now();

async function createTestUser(overrides: {
  email?: string;
  phone?: string;
  name?: string;
} = {}) {
  return db.user.create({
    data: {
      name: overrides.name ?? "Async Finish Tester",
      email: overrides.email ?? `async-finish-${RUN_ID}@example.com`,
      phone: overrides.phone ?? `0915${String(RUN_ID).slice(-7)}`,
      phoneVerifiedAt: new Date(),
    },
  });
}

async function startAssessmentForUser(
  userOverrides: { email?: string; phone?: string; name?: string } = {},
) {
  const user = await createTestUser(userOverrides);
  return startAssessment(
    {
      user: {
        name: "Async Finish Tester",
        email: user.email ?? `async-finish-${RUN_ID}@example.com`,
      },
      organization: {
        businessName: "Async Finish Co",
        industry: "technology",
        teamSize: "1-5",
        salesModel: "online",
      },
    },
    { userId: user.id },
  );
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

describe("async finish + token access (integration)", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects saveAnswers and finish without access credentials", async () => {
    const start = await startAssessmentForUser({
      email: `async-deny-${RUN_ID}@example.com`,
      phone: `0916${String(RUN_ID).slice(-7)}`,
    });

    await expect(
      saveAnswers(start.assessmentId, { answers: [] }, {}),
    ).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });

    await expect(
      finishAssessment(start.assessmentId, {}, {}),
    ).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });

    await expect(
      enqueueFinishAssessment(start.assessmentId, {}),
    ).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });
  });

  it("allows save/finish with result token and worker core completes", async () => {
    const start = await startAssessmentForUser({
      email: `async-ok-${RUN_ID}@example.com`,
      phone: `0917${String(RUN_ID).slice(-7)}`,
    });
    const access = { token: start.resultToken };
    const questions = await getAssessmentQuestions(start.assessmentId, access);
    const answers = buildAllAnswers(questions);

    await saveAnswers(start.assessmentId, { answers }, access);

    // Inline worker path (no Redis required).
    const finished = await runFinishAssessmentCore(start.assessmentId);
    expect(finished.status).toBe("completed");
    expect(finished.reportId).toBeTruthy();

    const status = await getFinishJobStatus(start.assessmentId, access);
    expect(status.status).toBe("completed");
    expect(status.reportId).toBe(finished.reportId);
  });

  it("returns completed finish status with token after sync finish", async () => {
    const start = await startAssessmentForUser({
      email: `async-status-${RUN_ID}@example.com`,
      phone: `0918${String(RUN_ID).slice(-7)}`,
    });
    const access = { token: start.resultToken };
    const questions = await getAssessmentQuestions(start.assessmentId, access);
    await saveAnswers(
      start.assessmentId,
      { answers: buildAllAnswers(questions) },
      access,
    );

    const finished = await finishAssessment(start.assessmentId, {}, access);
    const status = await getFinishJobStatus(start.assessmentId, access);

    expect(status).toMatchObject({
      status: "completed",
      reportId: finished.reportId,
      resultUrl: finished.resultUrl,
    });
  });
});
