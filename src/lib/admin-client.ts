import { apiPost } from "@/lib/api-client";

export async function adminLoginRequest(
  password: string,
): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/admin/login", { password });
}

export async function adminLogoutRequest(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/admin/logout");
}
