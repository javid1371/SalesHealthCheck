import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  automationHeartbeat: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  AUTOMATION_HEARTBEAT_KEYS,
  listAutomationHeartbeats,
  recordAutomationFailure,
  recordAutomationSuccess,
} from "@/modules/admin/automation-heartbeat.service";

describe("automation-heartbeat.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records success and clears last error", async () => {
    dbMock.automationHeartbeat.upsert.mockResolvedValue({});

    await recordAutomationSuccess(AUTOMATION_HEARTBEAT_KEYS.smsFunnel);

    expect(dbMock.automationHeartbeat.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "sms-funnel" },
        create: expect.objectContaining({
          key: "sms-funnel",
          lastError: null,
          lastErrorAt: null,
        }),
        update: expect.objectContaining({
          lastError: null,
        }),
      }),
    );
  });

  it("records failure message truncated to 500 chars", async () => {
    dbMock.automationHeartbeat.upsert.mockResolvedValue({});
    const long = "x".repeat(600);

    await recordAutomationFailure(
      AUTOMATION_HEARTBEAT_KEYS.leadAssignment,
      new Error(long),
    );

    const call = dbMock.automationHeartbeat.upsert.mock.calls[0]?.[0];
    expect(call.where).toEqual({ key: "lead-assignment" });
    expect(call.update.lastError).toHaveLength(500);
    expect(call.create.lastError).toHaveLength(500);
  });

  it("lists known heartbeat keys even when DB is empty", async () => {
    dbMock.automationHeartbeat.findMany.mockResolvedValue([]);

    const rows = await listAutomationHeartbeats();

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.key)).toEqual([
      "lead-assignment",
      "sms-funnel",
      "follow-up-reminders",
      "lead-backfill",
      "notify-consultation-fixed",
    ]);
    expect(rows.every((row) => row.lastSuccessAt === null)).toBe(true);
  });

  it("merges persisted heartbeat rows into the known key list", async () => {
    const successAt = new Date("2026-07-29T05:00:00.000Z");
    dbMock.automationHeartbeat.findMany.mockResolvedValue([
      {
        key: "sms-funnel",
        lastSuccessAt: successAt,
        lastErrorAt: null,
        lastError: null,
        updatedAt: successAt,
      },
    ]);

    const rows = await listAutomationHeartbeats();
    const sms = rows.find((row) => row.key === "sms-funnel");

    expect(sms?.lastSuccessAt).toBe(successAt.toISOString());
    expect(sms?.label).toBe("قیف پیامکی");
  });
});
