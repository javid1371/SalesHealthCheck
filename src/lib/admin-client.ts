import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { StaffUserSummary } from "@/modules/staff/staff.types";

export async function adminLoginRequest(
  phone: string,
  password: string,
): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/admin/login", { phone, password });
}

export async function adminLogoutRequest(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/admin/logout");
}

export async function fetchStaffUsers(): Promise<{ users: StaffUserSummary[] }> {
  return apiGet<{ users: StaffUserSummary[] }>("/api/staff");
}

export async function createStaffUserRequest(input: {
  name: string;
  phone: string;
  password: string;
  role: "admin" | "sales_expert";
}): Promise<{ user: StaffUserSummary }> {
  return apiPost<{ user: StaffUserSummary }>("/api/staff", input);
}

export async function setStaffUserActiveRequest(
  id: string,
  isActive: boolean,
): Promise<{ user: StaffUserSummary }> {
  return apiPatch<{ user: StaffUserSummary }>(`/api/staff/${id}`, { isActive });
}

export async function resetStaffUserPasswordRequest(
  id: string,
  password: string,
): Promise<{ password: string }> {
  return apiPost<{ password: string }>(`/api/staff/${id}/reset-password`, {
    password,
  });
}

export async function fetchSmsFunnelAdminData() {
  return apiGet<import("@/modules/sms-funnel/sms-funnel-admin.types").SmsFunnelAdminData>(
    "/api/admin/sms-funnel",
  );
}

export async function updateSmsFunnelSettingsRequest(input: {
  funnelEnabled?: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  maxUnanswered?: number;
  kavenegarSenderLine?: string | null;
  kavenegarOtpTemplate?: string | null;
}) {
  return apiPatch<{ settings: import("@/modules/sms-funnel/funnel-config.service").FunnelSettings }>(
    "/api/admin/sms-funnel/settings",
    input,
  );
}

export async function updateSmsFunnelStepRequest(
  sequenceKey: string,
  stepKey: string,
  input: {
    body?: string | null;
    bodyLow?: string | null;
    bodyMedium?: string | null;
    bodyHigh?: string | null;
    delayMs?: number | null;
    enabled?: boolean;
  },
) {
  return apiPatch<{
    step: import("@/modules/sms-funnel/funnel-config.service").ResolvedStepForAdmin;
  }>(`/api/admin/sms-funnel/steps/${encodeURIComponent(sequenceKey)}/${encodeURIComponent(stepKey)}`, input);
}

export async function updateLeadSettingsRequest(input: {
  autoAssignEnabled?: boolean;
  systemAssignDelayHours?: number;
  expertNewLeadSms?: string;
  maxOpenLeadsPerExpert?: number;
  hotLeadDirectAssigneeId?: string | null;
}) {
  return apiPatch<{
    settings: import("@/modules/consultation/lead-config.service").LeadSettings;
  }>("/api/admin/leads/settings", input);
}

export async function bulkUpdateLeadsRequest(input: {
  ids: string[];
  status?: import("@prisma/client").LeadStatus;
  assignedToId?: string | null;
}) {
  return apiPost<{ updated: number }>("/api/admin/leads/bulk", input);
}

export async function createManualLeadRequest(input: {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
}) {
  return apiPost<{ lead: import("@/modules/consultation/consultation.types").ConsultationListItem }>(
    "/api/admin/leads",
    input,
  );
}

export async function resetSmsFunnelStepRequest(sequenceKey: string, stepKey: string) {
  return apiPost<{
    step: import("@/modules/sms-funnel/funnel-config.service").ResolvedStepForAdmin;
  }>(
    `/api/admin/sms-funnel/steps/${encodeURIComponent(sequenceKey)}/${encodeURIComponent(stepKey)}/reset`,
    {},
  );
}
