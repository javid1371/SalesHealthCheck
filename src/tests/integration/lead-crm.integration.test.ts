/**
 * Lead config + bulk update integration — real PostgreSQL required.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password-auth";
import {
  bulkUpdateLeads,
  claimLead,
  createManualLead,
  getConsultationLeadDetail,
  listConsultationRequests,
  logCall,
  transferLead,
} from "@/modules/consultation/consultation.service";
import {
  formatActivityDetail,
  serializeCallLoggedDetail,
} from "@/modules/consultation/lead-activity";
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
    expect(settings.staleNewLeadHours).toBeGreaterThan(0);
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
    for (const activity of assignActivities) {
      expect(activity.detail).toContain(expert.id);
      expect(activity.detail).toContain(expert.name);
      expect(activity.detail).toContain('"fromId":null');
    }
  });

  it("transfers lead between experts and revokes previous owner access", async () => {
    const admin = await db.staffUser.create({
      data: {
        name: "Transfer Admin",
        phone: phoneFor(30),
        passwordHash: hashPassword("AdminPass123"),
        role: "admin",
      },
    });
    const fromExpert = await createStaffUserByAdmin({
      name: "Ali Transfer",
      phone: phoneFor(31),
      password: "ExpertPass123",
      role: "sales_expert",
    });
    const toExpert = await createStaffUserByAdmin({
      name: "Sara Transfer",
      phone: phoneFor(32),
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
    const fromAccess = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: fromExpert.id,
        name: fromExpert.name,
      },
    };
    const toAccess = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: toExpert.id,
        name: toExpert.name,
      },
    };

    const lead = await createManualLead(
      { name: "Transfer Lead", phone: phoneFor(33) },
      adminAccess,
    );
    await bulkUpdateLeads(
      { ids: [lead.id], assignedToId: fromExpert.id },
      adminAccess,
    );

    const transferred = await transferLead(
      lead.id,
      {
        toStaffUserId: toExpert.id,
        reason: "workload",
        note: "حجم کار بالا است لطفاً پیگیری کنید",
      },
      fromAccess,
    );
    expect(transferred.assignedToId).toBe(toExpert.id);

    await expect(getConsultationLeadDetail(lead.id, fromAccess)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });

    const detail = await getConsultationLeadDetail(lead.id, toAccess);
    expect(detail.assignedToId).toBe(toExpert.id);

    const activity = await db.leadActivity.findFirst({
      where: {
        consultationRequestId: lead.id,
        type: "assignment_change",
        detail: { contains: '"reason":"workload"' },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(activity).not.toBeNull();
    expect(formatActivityDetail("assignment_change", activity?.detail ?? null)).toBe(
      "Ali Transfer → Sara Transfer | حجم کار",
    );

    const note = await db.consultationNote.findFirst({
      where: {
        consultationRequestId: lead.id,
        body: { startsWith: "انتقال:" },
      },
    });
    expect(note?.body).toContain("حجم کار");
  });

  it("logs a call outcome, updates lastCall fields, and records activity", async () => {
    const passwordHash = await hashPassword("CallExpert123");
    const expert = await db.staffUser.create({
      data: {
        name: "Call Expert",
        phone: phoneFor(40),
        passwordHash,
        role: "sales_expert",
        isActive: true,
      },
    });
    const admin = await createStaffUserByAdmin({
      name: "Call Admin",
      phone: phoneFor(41),
      password: "CallAdmin123",
      role: "admin",
    });

    const adminAccess = {
      adminSession: {
        role: "admin" as const,
        staffUserId: admin.id,
        name: admin.name,
      },
      salesExpertSession: null,
    };
    const expertAccess = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: expert.id,
        name: expert.name,
      },
    };

    const lead = await createManualLead(
      { name: "Call Log Lead", phone: phoneFor(42) },
      adminAccess,
    );
    await bulkUpdateLeads(
      { ids: [lead.id], assignedToId: expert.id },
      adminAccess,
    );

    const logged = await logCall(
      lead.id,
      { outcome: "connected_interested", note: "جلسه هفته بعد" },
      expertAccess,
    );

    expect(logged.lastCallOutcome).toBe("connected_interested");
    expect(logged.lastCallOutcomeLabel).toBe("وصل — علاقه‌مند");
    expect(logged.status).toBe("new");

    const callLog = await db.leadCallLog.findFirst({
      where: { consultationRequestId: lead.id },
      orderBy: { createdAt: "desc" },
    });
    expect(callLog).toMatchObject({
      staffUserId: expert.id,
      outcome: "connected_interested",
      note: "جلسه هفته بعد",
    });

    const refreshed = await db.consultationRequest.findUniqueOrThrow({
      where: { id: lead.id },
    });
    expect(refreshed.lastCallOutcome).toBe("connected_interested");
    expect(refreshed.lastCalledAt).not.toBeNull();

    const activity = await db.leadActivity.findFirst({
      where: {
        consultationRequestId: lead.id,
        type: "call_logged",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(activity?.detail).toBe(
      serializeCallLoggedDetail("connected_interested", "جلسه هفته بعد"),
    );
    expect(formatActivityDetail("call_logged", activity?.detail ?? null)).toBe(
      "وصل — علاقه‌مند — جلسه هفته بعد",
    );

    await expect(
      logCall(lead.id, { outcome: "busy" }, {
        adminSession: null,
        salesExpertSession: {
          role: "sales_expert",
          staffUserId: "someone-else",
          name: "Other",
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("lets experts claim unassigned team-queue leads atomically", async () => {
    const passwordHash = await hashPassword("ClaimExpert123");
    const expertA = await db.staffUser.create({
      data: {
        name: "Claim Expert A",
        phone: phoneFor(50),
        passwordHash,
        role: "sales_expert",
        isActive: true,
      },
    });
    const expertB = await db.staffUser.create({
      data: {
        name: "Claim Expert B",
        phone: phoneFor(51),
        passwordHash,
        role: "sales_expert",
        isActive: true,
      },
    });
    const admin = await createStaffUserByAdmin({
      name: "Claim Admin",
      phone: phoneFor(52),
      password: "ClaimAdmin123",
      role: "admin",
    });

    const adminAccess = {
      adminSession: {
        role: "admin" as const,
        staffUserId: admin.id,
        name: admin.name,
      },
      salesExpertSession: null,
    };
    const accessA = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: expertA.id,
        name: expertA.name,
      },
    };
    const accessB = {
      adminSession: null,
      salesExpertSession: {
        role: "sales_expert" as const,
        staffUserId: expertB.id,
        name: expertB.name,
      },
    };

    const queueLead = await createManualLead(
      { name: "Queue Lead", phone: phoneFor(53) },
      adminAccess,
    );
    const otherLead = await createManualLead(
      { name: "Owned Lead", phone: phoneFor(54) },
      adminAccess,
    );
    await bulkUpdateLeads(
      { ids: [otherLead.id], assignedToId: expertB.id },
      adminAccess,
    );

    const queue = await listConsultationRequests(
      { page: 1, pageSize: 50, onlyTeamQueue: true },
      accessA,
    );
    expect(queue.requests.some((item) => item.id === queueLead.id)).toBe(true);
    expect(queue.requests.some((item) => item.id === otherLead.id)).toBe(false);

    const claimed = await claimLead(queueLead.id, accessA);
    expect(claimed.assignedToId).toBe(expertA.id);

    await expect(claimLead(queueLead.id, accessB)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    await updateLeadSettings({ maxOpenLeadsPerExpert: 1 });
    const capacityLead = await createManualLead(
      { name: "Capacity Lead", phone: phoneFor(55) },
      adminAccess,
    );
    await expect(claimLead(capacityLead.id, accessA)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});
