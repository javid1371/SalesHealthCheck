import { apiPatch, apiPost } from "@/lib/api-client";
import type { LeadStatus } from "@prisma/client";
import type {
  ConsultationLeadDetail,
  ConsultationListItem,
  ConsultationNoteItem,
} from "@/modules/consultation/consultation.types";

export async function salesExpertLoginRequest(
  phone: string,
  password: string,
): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/expert/login", { phone, password });
}

export async function salesExpertLogoutRequest(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/api/expert/logout", {});
}

export async function updateConsultationLeadRequest(
  id: string,
  input: {
    status?: LeadStatus;
    assignedToId?: string | null;
    nextFollowUpAt?: string | null;
    adminProbabilityOverridePercent?: number | null;
  },
): Promise<{ lead: ConsultationListItem }> {
  return apiPatch<{ lead: ConsultationListItem }>(
    `/api/consultations/${id}`,
    input,
  );
}

export async function addConsultationNoteRequest(
  id: string,
  body: string,
): Promise<{ note: ConsultationNoteItem }> {
  return apiPost<{ note: ConsultationNoteItem }>(
    `/api/consultations/${id}/notes`,
    { body },
  );
}

export type { ConsultationLeadDetail, ConsultationNoteItem };
