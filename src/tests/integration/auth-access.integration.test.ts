/**
 * OTP verify + result access integration — real PostgreSQL required.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { verifyOtp } from "@/modules/auth/auth.service";
import {
  finishAssessment,
  getAssessmentQuestions,
  getAssessmentResult,
  getReport,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";

const RUN_ID = Date.now();
const AUTH_SECRET =
  process.env.AUTH_SESSION_SECRET ??
  "integration-test-auth-secret-at-least-32-chars";

function phoneFor(suffix: number): string {
  return `0915${String(RUN_ID + suffix).slice(-7)}`;
}

const OTP_CODE = "112233";

function hashOtpCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${AUTH_SECRET}`)
    .digest("hex");
}

async function seedOtpCode(phone: string, code: string) {
  await db.otpCode.create({
    data: {
      phone,
      codeHash: hashOtpCode(phone, code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

function startPayload(userId: string) {
  return {
    user: { name: "Access Tester", email: `access-${RUN_ID}@example.com` },
    organization: {
      businessName: "Access Test Co",
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

describe("auth and result access (integration)", () => {
  beforeAll(() => {
    process.env.AUTH_SESSION_SECRET ??= AUTH_SECRET;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("verifyOtp creates user session identity for a new phone", async () => {
    const phone = phoneFor(1);
    await seedOtpCode(phone, OTP_CODE);

    const result = await verifyOtp({ phone, code: OTP_CODE });

    expect(result.userId).toBeTruthy();

    const user = await db.user.findUnique({ where: { id: result.userId } });
    expect(user?.phone).toBe(phone);
    expect(user?.phoneVerifiedAt).not.toBeNull();
  });

  it("startAssessment rejects unknown session user", async () => {
    const { context, ...payload } = startPayload("nonexistent-user-id");

    await expect(startAssessment(payload, context)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("session owner can read result without token; admin bypass works", async () => {
    const phone = phoneFor(3);
    await seedOtpCode(phone, OTP_CODE);
    const { userId } = await verifyOtp({ phone, code: OTP_CODE });
    const { context, ...payload } = startPayload(userId);
    const start = await startAssessment(payload, context);

    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, { answers: buildAllAnswers(questions) });
    await finishAssessment(start.assessmentId);

    const bySession = await getAssessmentResult(start.assessmentId, {
      userSession: { userId },
    });
    expect(bySession.overallScore.percentage).toBeGreaterThanOrEqual(0);

    const byAdmin = await getAssessmentResult(start.assessmentId, {
      adminSession: { role: "admin" },
    });
    expect(byAdmin.report.id).toBe(bySession.report.id);

    await expect(
      getAssessmentResult(start.assessmentId, {
        userSession: { userId: "other-user-id" },
      }),
    ).rejects.toMatchObject({
      code: "assessment_access_denied",
      status: 403,
    });
  }, 120_000);

  it("legacy resultToken still grants access", async () => {
    const phone = phoneFor(4);
    await seedOtpCode(phone, OTP_CODE);
    const { userId } = await verifyOtp({ phone, code: OTP_CODE });
    const { context, ...payload } = startPayload(userId);
    const start = await startAssessment(payload, context);

    const questions = await getAssessmentQuestions(start.assessmentId);
    await saveAnswers(start.assessmentId, { answers: buildAllAnswers(questions) });
    const finish = await finishAssessment(start.assessmentId);

    const byToken = await getAssessmentResult(start.assessmentId, {
      token: start.resultToken,
    });
    expect(byToken.report.id).toBe(finish.reportId);

    const report = await getReport(finish.reportId!, {
      token: start.resultToken,
    });
    expect(report.reportSpec).toBeTruthy();
  }, 120_000);
});
