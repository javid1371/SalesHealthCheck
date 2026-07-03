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
