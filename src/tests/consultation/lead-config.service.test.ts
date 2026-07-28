import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    leadAutoAssignEnabled: true,
    leadSystemAssignDelayHours: 24,
    leadAssessmentIncompleteAfterHours: 24,
    appBaseUrl: "https://app.example.com",
  },
}));

const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindStaffUserById = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    leadSetting: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

vi.mock("@/modules/staff/staff.repository", () => ({
  findStaffUserById: (...args: unknown[]) => mockFindStaffUserById(...args),
}));

describe("lead-config.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("returns env and code defaults when no DB settings exist", async () => {
    const { getLeadSettings, DEFAULT_EXPERT_NEW_LEAD_SMS } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await getLeadSettings();
    expect(settings).toEqual({
      autoAssignEnabled: true,
      systemAssignDelayHours: 24,
      expertNewLeadSms: DEFAULT_EXPERT_NEW_LEAD_SMS,
      maxOpenLeadsPerExpert: 30,
      hotLeadDirectAssigneeId: null,
      assessmentIncompleteAfterHours: 24,
      autoAssignExcludeStaffIds: [],
      staleNewLeadHours: 24,
    });
  });

  it("reads lead settings from DB when present", async () => {
    mockFindMany.mockResolvedValue([
      { key: "auto_assign_enabled", value: "false" },
      { key: "system_assign_delay_hours", value: "12" },
      { key: "expert_new_lead_sms", value: "لید جدید" },
      { key: "max_open_leads_per_expert", value: "15" },
      { key: "hot_lead_direct_assignee_id", value: "expert-1" },
      { key: "assessment_incomplete_after_hours", value: "48" },
      { key: "auto_assign_exclude_staff_ids", value: "expert-2,expert-3" },
      { key: "stale_new_lead_hours", value: "36" },
    ]);

    const { getLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await getLeadSettings();
    expect(settings).toEqual({
      autoAssignEnabled: false,
      systemAssignDelayHours: 12,
      expertNewLeadSms: "لید جدید",
      maxOpenLeadsPerExpert: 15,
      hotLeadDirectAssigneeId: "expert-1",
      assessmentIncompleteAfterHours: 48,
      autoAssignExcludeStaffIds: ["expert-2", "expert-3"],
      staleNewLeadHours: 36,
    });
  });

  it("persists settings via updateLeadSettings", async () => {
    mockUpsert.mockResolvedValue({});
    mockFindMany.mockResolvedValue([
      { key: "auto_assign_enabled", value: "true" },
      { key: "system_assign_delay_hours", value: "6" },
    ]);

    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await updateLeadSettings({
      autoAssignEnabled: true,
      systemAssignDelayHours: 6,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "system_assign_delay_hours" },
        create: { key: "system_assign_delay_hours", value: "6" },
      }),
    );
    expect(settings.systemAssignDelayHours).toBe(6);
  });

  it("rejects invalid delay hours", async () => {
    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    await expect(
      updateLeadSettings({ systemAssignDelayHours: -1 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects invalid maxOpenLeadsPerExpert", async () => {
    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    await expect(
      updateLeadSettings({ maxOpenLeadsPerExpert: 0 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("persists staleNewLeadHours", async () => {
    mockUpsert.mockResolvedValue({});
    mockFindMany.mockResolvedValue([
      { key: "stale_new_lead_hours", value: "48" },
    ]);

    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await updateLeadSettings({ staleNewLeadHours: 48 });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "stale_new_lead_hours" },
        create: { key: "stale_new_lead_hours", value: "48" },
      }),
    );
    expect(settings.staleNewLeadHours).toBe(48);
  });

  it("rejects invalid staleNewLeadHours", async () => {
    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    await expect(
      updateLeadSettings({ staleNewLeadHours: 0 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects empty expertNewLeadSms", async () => {
    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    await expect(
      updateLeadSettings({ expertNewLeadSms: "   " }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects expertNewLeadSms that overflows after placeholder interpolation", async () => {
    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const template = `${"ن".repeat(420)} {{name}} {{detailUrl}}`;
    await expect(
      updateLeadSettings({ expertNewLeadSms: template }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("clears hotLeadDirectAssigneeId when set to null", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });
    mockFindMany.mockResolvedValue([
      { key: "hot_lead_direct_assignee_id", value: "" },
    ]);

    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await updateLeadSettings({
      hotLeadDirectAssigneeId: null,
    });

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { key: "hot_lead_direct_assignee_id" },
    });
    expect(settings.hotLeadDirectAssigneeId).toBeNull();
  });

  it("validates hotLeadDirectAssigneeId is an active sales expert", async () => {
    mockFindStaffUserById.mockResolvedValue({
      id: "expert-1",
      isActive: false,
      role: "sales_expert",
    });

    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    await expect(
      updateLeadSettings({ hotLeadDirectAssigneeId: "expert-1" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("persists hotLeadDirectAssigneeId for active sales expert", async () => {
    mockFindStaffUserById.mockResolvedValue({
      id: "expert-1",
      isActive: true,
      role: "sales_expert",
    });
    mockUpsert.mockResolvedValue({});
    mockFindMany.mockResolvedValue([
      { key: "hot_lead_direct_assignee_id", value: "expert-1" },
    ]);

    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await updateLeadSettings({
      hotLeadDirectAssigneeId: "expert-1",
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "hot_lead_direct_assignee_id" },
        create: { key: "hot_lead_direct_assignee_id", value: "expert-1" },
      }),
    );
    expect(settings.hotLeadDirectAssigneeId).toBe("expert-1");
  });

  it("persists autoAssignExcludeStaffIds for sales experts", async () => {
    mockFindStaffUserById.mockResolvedValue({
      id: "expert-2",
      isActive: true,
      role: "sales_expert",
    });
    mockUpsert.mockResolvedValue({});
    mockFindMany.mockResolvedValue([
      { key: "auto_assign_exclude_staff_ids", value: "expert-2" },
    ]);

    const { updateLeadSettings } = await import(
      "@/modules/consultation/lead-config.service"
    );
    const settings = await updateLeadSettings({
      autoAssignExcludeStaffIds: ["expert-2"],
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "auto_assign_exclude_staff_ids" },
        create: { key: "auto_assign_exclude_staff_ids", value: "expert-2" },
      }),
    );
    expect(settings.autoAssignExcludeStaffIds).toEqual(["expert-2"]);
  });
});
