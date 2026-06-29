/**
 * finishAssessment integration gate — real PostgreSQL required.
 * Any change to finishAssessment must keep this suite green (see project-rules.md).
 */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  finishAssessment,
  getAssessmentQuestions,
  getReport,
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
      name: overrides.name ?? "Finish Gate Tester",
      email: overrides.email ?? `finish-gate-${RUN_ID}@example.com`,
      phone: overrides.phone ?? `0912${String(RUN_ID).slice(-7)}`,
      phoneVerifiedAt: new Date(),
    },
  });
}

function startPayload(userId: string) {
  return {
    user: {
      name: "Finish Gate Tester",
      email: `finish-gate-${RUN_ID}@example.com`,
    },
    organization: {
      businessName: "Finish Gate Co",
      industry: "technology",
      teamSize: "1-5",
      salesModel: "online" as const,
    },
    context: { userId },
  };
}

async function startAssessmentForUser(
  userOverrides: { email?: string; phone?: string; name?: string } = {},
) {
  const user = await createTestUser(userOverrides);
  const { context, ...payload } = startPayload(user.id);
  return startAssessment(payload, context);
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

describe("finishAssessment (integration)", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("completes full flow: start → 80 answers → finish → report + reportSpec", async () => {
    const start = await startAssessmentForUser();
    const questions = await getAssessmentQuestions(start.assessmentId);
    const answers = buildAllAnswers(questions);

    expect(answers.length).toBe(80);

    await saveAnswers(start.assessmentId, { answers });

    const finish = await finishAssessment(start.assessmentId);

    expect(finish.status).toBe("completed");
    expect(finish.reportId).toBeTruthy();

    const report = await getReport(finish.reportId!, {
      token: start.resultToken,
    });
    expect(report.reportSpec).toBeTruthy();
    expect(report.reportSpec!.domainBreakdown).toHaveLength(16);
    const structured = report.structuredReport as {
      domainResults: unknown[];
    };
    expect(structured.domainResults.length).toBeGreaterThan(0);
    expect(report.bottlenecks.length).toBeGreaterThanOrEqual(3);
  });

  it("returns the same reportId on idempotent finish", async () => {
    const start = await startAssessmentForUser({
      email: `finish-idempotent-${RUN_ID}@example.com`,
      phone: `0913${String(RUN_ID).slice(-7)}`,
    });
    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, {
      answers: buildAllAnswers(questions),
    });

    const first = await finishAssessment(start.assessmentId);
    const second = await finishAssessment(start.assessmentId);

    expect(first.reportId).toBeTruthy();
    expect(second.reportId).toBe(first.reportId);
  });

  it("rejects finish when not all 80 questions are answered", async () => {
    const start = await startAssessmentForUser({
      email: `finish-incomplete-${RUN_ID}@example.com`,
      phone: `0914${String(RUN_ID).slice(-7)}`,
    });
    const questions = await getAssessmentQuestions(start.assessmentId);
    const partial = buildAllAnswers(questions).slice(0, 10);

    await saveAnswers(start.assessmentId, { answers: partial });

    await expect(finishAssessment(start.assessmentId)).rejects.toMatchObject({
      code: "assessment_not_complete",
      status: 400,
    });
  });
});
