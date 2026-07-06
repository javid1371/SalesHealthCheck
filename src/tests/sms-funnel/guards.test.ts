import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SequenceStepDefinition } from "@/modules/sms-funnel/sequences";

vi.mock("@/lib/env", () => ({
  env: {
    smsFunnelEnabled: true,
    smsFunnelMaxUnanswered: 4,
  },
}));

vi.mock("@/modules/sms-funnel/funnel-config.service", () => ({
  isFunnelEnabledFromSettings: vi.fn().mockResolvedValue(true),
  getFunnelSettings: vi.fn().mockResolvedValue({
    funnelEnabled: true,
    quietHoursStart: 9,
    quietHoursEnd: 21,
    maxUnanswered: 4,
  }),
}));

const mockFindEnrollmentById = vi.fn();
const mockFindUserPhone = vi.fn();
const mockIsPhoneOptedOut = vi.fn();
const mockHasFunnelEvent = vi.fn();
const mockCountConsultationRequests = vi.fn();
const mockUserHasInProgressOrCompletedAssessment = vi.fn();

vi.mock("@/modules/sms-funnel/funnel.repository", () => ({
  findEnrollmentById: (...args: unknown[]) => mockFindEnrollmentById(...args),
  findUserPhone: (...args: unknown[]) => mockFindUserPhone(...args),
  isPhoneOptedOut: (...args: unknown[]) => mockIsPhoneOptedOut(...args),
  hasFunnelEvent: (...args: unknown[]) => mockHasFunnelEvent(...args),
  countConsultationRequests: (...args: unknown[]) =>
    mockCountConsultationRequests(...args),
  userHasInProgressOrCompletedAssessment: (...args: unknown[]) =>
    mockUserHasInProgressOrCompletedAssessment(...args),
}));

describe("evaluateSendGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUserPhone.mockResolvedValue("09120000000");
    mockIsPhoneOptedOut.mockResolvedValue(false);
    mockHasFunnelEvent.mockResolvedValue(false);
    mockCountConsultationRequests.mockResolvedValue(0);
    mockUserHasInProgressOrCompletedAssessment.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("blocks when consultation already exists on nurture step", async () => {
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr1",
      userId: "u1",
      status: "active",
      sequenceKey: "seq_nurture",
      assessmentSessionId: "a1",
      messagesSentCount: 0,
      scoreBand: "medium",
      assessmentSession: { id: "a1", status: "completed", resultToken: "tok" },
    });
    mockCountConsultationRequests.mockResolvedValue(1);

    const { evaluateSendGuard } = await import("@/modules/sms-funnel/guards");
    const step: SequenceStepDefinition = {
      stepKey: "S4-1",
      delayMs: 0,
      linkPurpose: "consultation",
      requiresNoConsultation: true,
      body: "test",
    };

    const result = await evaluateSendGuard({ enrollmentId: "enr1", step });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("consultation_exists");
  });

  it("blocks opted-out phones", async () => {
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr1",
      userId: "u1",
      status: "active",
      sequenceKey: "seq_start",
      assessmentSessionId: null,
      messagesSentCount: 0,
      scoreBand: null,
      assessmentSession: null,
    });
    mockIsPhoneOptedOut.mockResolvedValue(true);

    const { evaluateSendGuard } = await import("@/modules/sms-funnel/guards");
    const step: SequenceStepDefinition = {
      stepKey: "S1-1",
      delayMs: 0,
      linkPurpose: "start",
      body: "test",
    };

    const result = await evaluateSendGuard({ enrollmentId: "enr1", step });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("opt_out");
  });

  it("blocks seq_start when user already has an in-progress or completed assessment", async () => {
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr1",
      userId: "u1",
      status: "active",
      sequenceKey: "seq_start",
      assessmentSessionId: null,
      messagesSentCount: 0,
      scoreBand: null,
      assessmentSession: null,
    });
    mockUserHasInProgressOrCompletedAssessment.mockResolvedValue(true);

    const { evaluateSendGuard } = await import("@/modules/sms-funnel/guards");
    const step: SequenceStepDefinition = {
      stepKey: "S1-1",
      delayMs: 0,
      linkPurpose: "start",
      body: "test",
    };

    const result = await evaluateSendGuard({ enrollmentId: "enr1", step });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("assessment_already_started");
    expect(mockUserHasInProgressOrCompletedAssessment).toHaveBeenCalledWith("u1");
  });

  it("allows seq_start when user has no in-progress or completed assessment", async () => {
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr1",
      userId: "u1",
      status: "active",
      sequenceKey: "seq_start",
      assessmentSessionId: null,
      messagesSentCount: 0,
      scoreBand: null,
      assessmentSession: null,
    });
    mockUserHasInProgressOrCompletedAssessment.mockResolvedValue(false);

    const { evaluateSendGuard } = await import("@/modules/sms-funnel/guards");
    const step: SequenceStepDefinition = {
      stepKey: "S1-1",
      delayMs: 0,
      linkPurpose: "start",
      body: "test",
    };

    const result = await evaluateSendGuard({ enrollmentId: "enr1", step });
    expect(result.allowed).toBe(true);
  });

  it("blocks seq_start when linked assessment is not in started state", async () => {
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr1",
      userId: "u1",
      status: "active",
      sequenceKey: "seq_start",
      assessmentSessionId: "a1",
      messagesSentCount: 0,
      scoreBand: null,
      assessmentSession: { id: "a1", status: "in_progress", resultToken: "tok" },
    });
    mockUserHasInProgressOrCompletedAssessment.mockResolvedValue(false);

    const { evaluateSendGuard } = await import("@/modules/sms-funnel/guards");
    const step: SequenceStepDefinition = {
      stepKey: "S1-1",
      delayMs: 0,
      linkPurpose: "start",
      body: "test",
    };

    const result = await evaluateSendGuard({ enrollmentId: "enr1", step });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("assessment_not_in_progress");
  });

  it("blocks converted enrollments", async () => {
    mockFindEnrollmentById.mockResolvedValue({
      id: "enr1",
      userId: "u1",
      status: "converted",
      sequenceKey: "seq_nurture",
      assessmentSessionId: "a1",
      messagesSentCount: 2,
      scoreBand: "medium",
      assessmentSession: { id: "a1", status: "completed", resultToken: "tok" },
    });

    const { evaluateSendGuard } = await import("@/modules/sms-funnel/guards");
    const step: SequenceStepDefinition = {
      stepKey: "S4-1",
      delayMs: 0,
      linkPurpose: "consultation",
      body: "test",
    };

    const result = await evaluateSendGuard({ enrollmentId: "enr1", step });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("converted");
  });
});
