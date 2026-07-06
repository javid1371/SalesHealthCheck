/**
 * Lead config + bulk update integration — real PostgreSQL required.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password-auth";
import {
  bulkUpdateLeads,
  createManualLead,
} from "@/modules/consultation/consultation.service";
import {
  getLeadSettings,
  updateLeadSettings,
} from "@/modules/consultation/lead-config.service";
import { createStaffUserByAdmin } from "@/modules/staff/staff.service";

const RUN_ID = Date.now();

function phoneFor(suffix: number): string {
  return `0918${String(RUN_ID + suffix).slice(-7)}`;
}

describe("lead config and bulk updates (integration)", () => {
  beforeEach(async () => {
    await db.leadSetting.deleteMany();
  });

  afterAll(async () => {
    await db.leadSetting.deleteMany();
    await db.$disconnect();
  });

  it("reads env defaults when lead settings table is empty", async () => {
    const settings = await getLeadSettings();

    expect(typeof settings.autoAssignEnabled).toBe("boolean");
    expect(settings.systemAssignDelayHours).toBeGreaterThanOrEqual(0);
    expect(settings.expertNewLeadSms.length).toBeGreaterThan(0);
    expect(settings.maxOpenLeadsPerExpert).toBeGreaterThan(0);
    expect(settings.hotLeadDirectAssigneeId).toBeNull();
  });

  it("persists and reads lead settings from DB", async () => {
    const updated = await updateLeadSettings({
      autoAssignEnabled: false,
      systemAssignDelayHours: 8,
      expertNewLeadSms: "لید تست",
      maxOpenLeadsPerExpert: 20,
    });

    expect(updated).toMatchObject({
      autoAssignEnabled: false,
      systemAssignDelayHours: 8,
      expertNewLeadSms: "لید تست",
      maxOpenLeadsPerExpert: 20,
    });

    const rows = await db.leadSetting.findMany();
    expect(rows).toEqual(
      expect.arrayContaining([
        { key: "auto_assign_enabled", value: "false", updatedAt: expect.any(Date) },
        { key: "system_assign_delay_hours", value: "8", updatedAt: expect.any(Date) },
        { key: "expert_new_lead_sms", value: "لید تست", updatedAt: expect.any(Date) },
        { key: "max_open_leads_per_expert", value: "20", updatedAt: expect.any(Date) },
      ]),
    );

    const reread = await getLeadSettings();
    expect(reread).toEqual(updated);
  });

  it("assigns hotLeadDirectAssigneeId to active sales expert", async () => {
    const expert = await createStaffUserByAdmin({
      name: "Hot Lead Expert",
      phone: phoneFor(10),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const settings = await updateLeadSettings({
      hotLeadDirectAssigneeId: expert.id,
    });

    expect(settings.hotLeadDirectAssigneeId).toBe(expert.id);

    await updateLeadSettings({ hotLeadDirectAssigneeId: null });
    const cleared = await getLeadSettings();
    expect(cleared.hotLeadDirectAssigneeId).toBeNull();
  });

  it("bulk updates lead status and records activity with timestamps", async () => {
    const admin = await db.staffUser.create({
      data: {
        name: "Bulk Admin",
        phone: phoneFor(20),
        passwordHash: hashPassword("AdminPass123"),
        role: "admin",
      },
    });

    const expert = await createStaffUserByAdmin({
      name: "Bulk Expert",
      phone: phoneFor(21),
      password: "ExpertPass123",
      role: "sales_expert",
    });

    const adminAccess = {
      adminSession: {
        role: "admin" as const,
        staffUserId: admin.id,
        name: admin.name,
      },
      salesExpertSession: null,
    };

    const leadA = await createManualLead(
      { name: "Bulk Lead A", phone: phoneFor(22) },
      adminAccess,
    );
    const leadB = await createManualLead(
      { name: "Bulk Lead B", phone: phoneFor(23) },
      adminAccess,
    );

    const statusResult = await bulkUpdateLeads(
      { ids: [leadA.id, leadB.id], status: "contacted" },
      adminAccess,
    );
    expect(statusResult.updated).toBe(2);

    const contactedRows = await db.consultationRequest.findMany({
      where: { id: { in: [leadA.id, leadB.id] } },
    });
    for (const row of contactedRows) {
      expect(row.status).toBe("contacted");
      expect(row.firstContactedAt).not.toBeNull();
    }

    const statusActivities = await db.leadActivity.findMany({
      where: {
        consultationRequestId: { in: [leadA.id, leadB.id] },
        type: "status_change",
      },
    });
    expect(statusActivities).toHaveLength(2);
    expect(statusActivities.every((a) => a.detail === "new→contacted")).toBe(
      true,
    );

    const assignResult = await bulkUpdateLeads(
      { ids: [leadA.id, leadB.id], assignedToId: expert.id },
      adminAccess,
    );
    expect(assignResult.updated).toBe(2);

    const assignedRows = await db.consultationRequest.findMany({
      where: { id: { in: [leadA.id, leadB.id] } },
    });
    expect(assignedRows.every((row) => row.assignedToId === expert.id)).toBe(
      true,
    );

    const assignActivities = await db.leadActivity.findMany({
      where: {
        consultationRequestId: { in: [leadA.id, leadB.id] },
        type: "assignment_change",
      },
    });
    expect(assignActivities).toHaveLength(2);
    expect(assignActivities.every((a) => a.detail === expert.id)).toBe(true);
  });
});
