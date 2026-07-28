import { apiPost } from "@/lib/api-client";
import type { StaffRole } from "@prisma/client";

export type StaffLoginResponse = {
  ok: boolean;
  role: StaffRole;
  redirectTo: string;
};

export async function staffLoginRequest(
  phone: string,
  password: string,
): Promise<StaffLoginResponse> {
  return apiPost<StaffLoginResponse>("/api/staff/login", { phone, password });
}
