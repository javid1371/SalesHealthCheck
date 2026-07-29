import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin/admin.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/admin/admin.repository")>();
  return {
    ...actual,
    countPendingAssignmentLeads: vi.fn(),
    countUnassignedOpenLeads: vi.fn(),
    countOverdueFollowUps: vi.fn(),
    countStaleNewLeads: vi.fn(),
    countHighProbabilityUnassigned: vi.fn(),
    countFirstContactSlaBreachedLeads: vi.fn(),
    findPendingAssignmentLeads: vi.fn(),
    findUnassignedOpenLeads: vi.fn(),
    findOverdueFollowUpLeads: vi.fn(),
    findStaleNewLeadsForOps: vi.fn(),
    findHighProbabilityUnassignedLeads: vi.fn(),
    findFirstContactSlaBreachedLeads: vi.fn(),
    groupLeadsByAssignee: vi.fn(),
    findActiveSalesExperts: vi.fn(),
    countCallsByStaffSince: vi.fn(),
    countStalePendingSmsMessages: vi.fn(),
  };
});

vi.mock("@/modules/admin/automation-heartbeat.service", () => ({
  listAutomationHeartbeats: vi.fn(),
}));

vi.mock("@/modules/consultation/lead-config.service", () => ({
  getLeadSettings: vi.fn().mockResolvedValue({
    autoAssignEnabled: true,
    systemAssignDelayHours: 24,
    expertNewLeadSms: "لید جدید",
    maxOpenLeadsPerExpert: 10,
    hotLeadDirectAssigneeId: null,
    assessmentIncompleteAfterHours: 24,
    autoAssignExcludeStaffIds: [],
    staleNewLeadHours: 24,
    routingRules: {
      firstContactSlaMinutesByBand: { high: 30, mid: 120, low: 240 },
      preferAssigneeBySource: {},
      excludeSourcesFromAutoAssign: [],
    },
    callOutcomeMatrix: {
      no_answer: { nextFollowUpDays: 1 },
      busy: { nextFollowUpDays: 1 },
      callback_requested: { status: "contacted", nextFollowUpDays: 1 },
      connected_interested: { status: "contacted", nextFollowUpDays: null },
      connected_not_interested: { status: "closed_lost" },
      wrong_number: { status: "closed_lost", lostReason: "low_quality" },
    },
    requireCallOutcomeBeforeClose: false,
    createLeadOnAssessmentStart: true,
    pauseSystemLeadCreation: false,
  }),
}));

vi.mock("@/modules/sms-funnel/funnel-config.service", () => ({
  getFunnelSettings: vi.fn().mockResolvedValue({
    funnelEnabled: true,
    quietHoursStart: 8,
    quietHoursEnd: 22,
    maxUnanswered: 3,
    kavenegarSenderLine: null,
    kavenegarOtpTemplate: null,
  }),
}));

import { getOpsCommandCenter } from "@/modules/admin/admin.service";
import {
  countPendingAssignmentLeads,
  countUnassignedOpenLeads,
  countOverdueFollowUps,
  countStaleNewLeads,
  countHighProbabilityUnassigned,
  countFirstContactSlaBreachedLeads,
  findPendingAssignmentLeads,
  findUnassignedOpenLeads,
  findOverdueFollowUpLeads,
  findStaleNewLeadsForOps,
  findHighProbabilityUnassignedLeads,
  findFirstContactSlaBreachedLeads,
  groupLeadsByAssignee,
  findActiveSalesExperts,
  countCallsByStaffSince,
  countStalePendingSmsMessages,
} from "@/modules/admin/admin.repository";
import { listAutomationHeartbeats } from "@/modules/admin/automation-heartbeat.service";
import { getFunnelSettings } from "@/modules/sms-funnel/funnel-config.service";

const sampleLead = {
  id: "lead-1",
  name: "علی",
  phone: "09120000000",
  status: "new" as const,
  source: "system" as const,
  purchaseProbabilityBand: "high" as const,
  nextFollowUpAt: null,
  createdAt: new Date("2026-07-20T10:00:00.000Z"),
  firstContactedAt: null,
  assignScheduledFor: new Date("2026-07-21T10:00:00.000Z"),
  assignedToId: null,
  assignedTo: null,
};

describe("getOpsCommandCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countPendingAssignmentLeads).mockResolvedValue(1);
    vi.mocked(countUnassignedOpenLeads).mockResolvedValue(2);
    vi.mocked(countOverdueFollowUps).mockResolvedValue(0);
    vi.mocked(countStaleNewLeads).mockResolvedValue(1);
    vi.mocked(countHighProbabilityUnassigned).mockResolvedValue(1);
    vi.mocked(countFirstContactSlaBreachedLeads).mockResolvedValue(1);
    vi.mocked(findPendingAssignmentLeads).mockResolvedValue([sampleLead]);
    vi.mocked(findUnassignedOpenLeads).mockResolvedValue([sampleLead]);
    vi.mocked(findOverdueFollowUpLeads).mockResolvedValue([]);
    vi.mocked(findStaleNewLeadsForOps).mockResolvedValue([sampleLead]);
    vi.mocked(findHighProbabilityUnassignedLeads).mockResolvedValue([
      sampleLead,
    ]);
    vi.mocked(findFirstContactSlaBreachedLeads).mockResolvedValue([sampleLead]);
    vi.mocked(groupLeadsByAssignee).mockResolvedValue([
      {
        assignedToId: "expert-1",
        status: "new",
        _count: { id: 8 },
      },
      {
        assignedToId: "expert-1",
        status: "closed_won",
        _count: { id: 3 },
      },
    ] as never);
    vi.mocked(findActiveSalesExperts).mockResolvedValue([
      {
        id: "expert-1",
        name: "کارشناس یک",
        assignmentPausedAt: null,
        assignmentPausedReason: null,
        maxDailyCalls: 5,
      },
    ]);
    vi.mocked(countCallsByStaffSince).mockResolvedValue([
      { staffUserId: "expert-1", _count: { id: 5 } },
    ] as never);
    vi.mocked(countStalePendingSmsMessages).mockResolvedValue(4);
    vi.mocked(listAutomationHeartbeats).mockResolvedValue([
      {
        key: "sms-funnel",
        label: "قیف پیامکی",
        lastSuccessAt: "2026-07-29T04:00:00.000Z",
        lastErrorAt: null,
        lastError: null,
      },
    ]);
  });

  it("builds actionable queues, capacity, and automation health", async () => {
    const ops = await getOpsCommandCenter();

    expect(ops.queues).toHaveLength(6);
    expect(ops.queues[0]).toMatchObject({
      key: "pendingAssignment",
      count: 1,
      listHref: "/expert/consultations?onlyPendingAssignment=true",
    });
    expect(ops.queues[0]?.leads[0]).toMatchObject({
      id: "lead-1",
      detailUrl: "/expert/consultations/lead-1",
      statusLabel: "آماده تماس",
      firstContactSlaBreached: true,
    });
    expect(ops.queues[5]).toMatchObject({
      key: "firstContactSla",
      count: 1,
    });
    expect(ops.expertCapacity).toEqual([
      {
        staffUserId: "expert-1",
        name: "کارشناس یک",
        openLeads: 8,
        maxOpenLeads: 10,
        utilizationPercent: 80,
        nearCapacity: true,
        assignmentPaused: false,
        assignmentPausedReason: null,
        callsToday: 5,
        maxDailyCalls: 5,
        dailyCapReached: true,
        queueHref: "/expert/consultations?assignedToId=expert-1",
      },
    ]);
    expect(ops.settings.firstContactSlaMinutesByBand).toEqual({
      high: 30,
      mid: 120,
      low: 240,
    });
    expect(ops.automation.stalePendingSmsCount).toBe(4);
    expect(ops.automation.stalePendingSmsMinutes).toBe(15);
    expect(ops.smsFunnel.funnelEnabled).toBe(true);
    expect(getFunnelSettings).toHaveBeenCalled();
    expect(countStaleNewLeads).toHaveBeenCalledWith(24);
    expect(findStaleNewLeadsForOps).toHaveBeenCalledWith(24);
    expect(countFirstContactSlaBreachedLeads).toHaveBeenCalledWith({
      high: 30,
      mid: 120,
      low: 240,
    });
    expect(countStalePendingSmsMessages).toHaveBeenCalledWith(15);
  });
});
