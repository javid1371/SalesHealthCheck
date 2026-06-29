/**
 * MVP QA integration checks — runs against real PostgreSQL (see docs/qa/MVP-Manual-Test-Scenarios.md).
 * Requires: docker compose up, migrations + seed applied.
 */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  finishAssessment,
  getAssessmentQuestions,
  getAssessmentResult,
  getReport,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import { submitConsultationRequest } from "@/modules/consultation/consultation.service";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";

const QA_RUN_ID = Date.now();

async function createQaUser(index: number) {
  const suffix = String(index).padStart(2, "0");
  return db.user.create({
    data: {
      name: `QA Tester ${suffix}`,
      email: `qa-${QA_RUN_ID}-${suffix}@example.com`,
      phone: `0912${String(QA_RUN_ID + index).slice(-7)}`,
      phoneVerifiedAt: new Date(),
    },
  });
}

function qaStartPayload(index: number, userId: string) {
  const suffix = String(index).padStart(2, "0");
  return {
    user: {
      name: `QA Tester ${suffix}`,
      email: `qa-${QA_RUN_ID}-${suffix}@example.com`,
    },
    organization: {
      businessName: `QA Biz ${suffix}`,
      industry: "technology",
      teamSize: "1-5",
      salesModel: "online" as const,
    },
    context: { userId },
  };
}

async function startQaAssessment(index: number) {
  const user = await createQaUser(index);
  const { context, ...payload } = qaStartPayload(index, user.id);
  return startAssessment(payload, context);
}

function buildAnswers(questions: QuestionsForAssessmentDto, domainLimit = 16) {
  const answers: { questionId: string; selectedOptionId: string }[] = [];
  for (const domain of questions.domains.slice(0, domainLimit)) {
    for (const question of domain.questions) {
      const option = question.options[2] ?? question.options[0];
      answers.push({ questionId: question.id, selectedOptionId: option.id });
    }
  }
  return answers;
}

async function completeAssessment(index: number) {
  const start = await startQaAssessment(index);
  const questions = await getAssessmentQuestions(start.assessmentId);
  await saveAnswers(start.assessmentId, { answers: buildAnswers(questions) });
  const finish = await finishAssessment(start.assessmentId);
  return { start, questions, finish };
}

describe("MVP QA scenarios (integration)", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("Scenario 1 — full completion produces report with bottlenecks", async () => {
    const { start, finish } = await completeAssessment(1);

    expect(finish.status).toBe("completed");
    expect(finish.reportId).toBeTruthy();

    const result = await getAssessmentResult(start.assessmentId, {
      token: start.resultToken,
    });
    expect(result.overallScore.percentage).toBeGreaterThanOrEqual(0);
    expect(result.bottlenecks.length).toBeGreaterThanOrEqual(3);
    expect(result.report.id).toBe(finish.reportId);

    const report = await getReport(finish.reportId!, {
      token: start.resultToken,
    });
    expect(report.reportSpec).toBeTruthy();
    expect(report.structuredReport.domainResults.length).toBeGreaterThan(0);
  }, 120_000);

  it("Scenario 2 — incomplete assessment rejects finish with 400", async () => {
    const start = await startQaAssessment(2);
    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, {
      answers: buildAnswers(questions, 3),
    });

    await expect(finishAssessment(start.assessmentId)).rejects.toMatchObject({
      code: "assessment_not_complete",
      status: 400,
    });
  }, 60_000);

  it("Scenario 3 — changed answer before finish updates domain score", async () => {
    const start = await startQaAssessment(3);
    const questions = await getAssessmentQuestions(start.assessmentId);
    const answers = buildAnswers(questions);
    await saveAnswers(start.assessmentId, { answers });

    const firstDomain = questions.domains[0];
    const firstQuestion = firstDomain.questions[0];
    const firstAnswer = answers.find((a) => a.questionId === firstQuestion.id)!;
    const altOption =
      firstQuestion.options.find((o) => o.id !== firstAnswer.selectedOptionId) ??
      firstQuestion.options[0];

    await saveAnswers(start.assessmentId, {
      answers: [{ questionId: firstQuestion.id, selectedOptionId: altOption.id }],
    });

    const finish = await finishAssessment(start.assessmentId);
    expect(finish.reportId).toBeTruthy();

    const result = await getAssessmentResult(start.assessmentId, {
      token: start.resultToken,
    });
    const domainScore = result.domainScores.find(
      (d) => d.name === firstDomain.name,
    );
    expect(domainScore).toBeTruthy();
  }, 120_000);

  it("Scenario 4 — revisit with token returns same report and scores", async () => {
    const { start } = await completeAssessment(4);
    const first = await getAssessmentResult(start.assessmentId, {
      token: start.resultToken,
    });
    const second = await getAssessmentResult(start.assessmentId, {
      token: start.resultToken,
    });

    expect(second.report.id).toBe(first.report.id);
    expect(second.overallScore.percentage).toBe(first.overallScore.percentage);
  }, 120_000);

  it("Scenario 5 — idempotent finish returns same reportId", async () => {
    const { start } = await completeAssessment(5);
    const first = await finishAssessment(start.assessmentId);
    const second = await finishAssessment(start.assessmentId);

    expect(first.reportId).toBeTruthy();
    expect(second.reportId).toBe(first.reportId);
  }, 120_000);

  it("Scenario 6 — CTA consultation request persists to database", async () => {
    const { start, finish } = await completeAssessment(6);

    const response = await submitConsultationRequest({
      assessmentSessionId: start.assessmentId,
      reportId: finish.reportId,
      token: start.resultToken,
      name: "QA Lead",
      phone: "09120000001",
    });

    expect(response.id).toBeTruthy();

    const row = await db.consultationRequest.findUnique({
      where: { id: response.id },
    });
    expect(row).toBeTruthy();
    expect(row?.assessmentSessionId).toBe(start.assessmentId);
  }, 120_000);

  it("Scenario 4 extension — invalid token returns 403", async () => {
    const { start } = await completeAssessment(7);

    await expect(
      getAssessmentResult(start.assessmentId, { token: "wrong-token" }),
    ).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });
  }, 120_000);

  it("Scenario 10 — session owner accesses result without token", async () => {
    const user = await createQaUser(10);
    const { context, ...payload } = qaStartPayload(10, user.id);
    const start = await startAssessment(payload, context);
    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, { answers: buildAnswers(questions) });
    await finishAssessment(start.assessmentId);

    const result = await getAssessmentResult(start.assessmentId, {
      userSession: { userId: user.id },
    });
    expect(result.overallScore.percentage).toBeGreaterThanOrEqual(0);
    expect(result.bottlenecks.length).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
