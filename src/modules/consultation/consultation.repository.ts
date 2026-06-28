import { db } from "@/lib/db";
import type { CreateConsultationRequestInput } from "@/modules/assessment/assessment.types";

export async function createConsultationRequest(
  input: CreateConsultationRequestInput,
) {
  return db.consultationRequest.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      assessmentSessionId: input.assessmentSessionId,
      reportId: input.reportId,
    },
  });
}
