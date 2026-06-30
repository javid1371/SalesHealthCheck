import { apiPost } from "@/lib/api-client";

export async function salesExpertLoginRequest(
  password: string,
): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/expert/login", { password });
}

export async function salesExpertLogoutRequest(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/expert/logout", {});
}
