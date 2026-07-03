import { handleApiRequest } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import {
  createFunnelEvent,
  findAssessmentForFunnel,
  hasFunnelEvent,
} from "@/modules/sms-funnel/funnel.repository";
import {
  hookConsultationStarted,
  hookReportViewed,
} from "@/modules/sms-funnel/hooks";

type FunnelEventBody = {
  type: "report_viewed" | "consultation_started" | "cta_clicked";
  assessmentSessionId: string;
  token?: string;
};

function validateBody(body: unknown): FunnelEventBody {
  if (!body || typeof body !== "object") {
    throw new AppError("VALIDATION_ERROR", "Invalid request body", 400);
  }

  const record = body as Record<string, unknown>;
  const type = record.type;
  const assessmentSessionId = record.assessmentSessionId;

  if (
    type !== "report_viewed" &&
    type !== "consultation_started" &&
    type !== "cta_clicked"
  ) {
    throw new AppError("VALIDATION_ERROR", "Invalid event type", 400);
  }

  if (typeof assessmentSessionId !== "string" || !assessmentSessionId) {
    throw new AppError("VALIDATION_ERROR", "assessmentSessionId is required", 400);
  }

  return {
    type,
    assessmentSessionId,
    token: typeof record.token === "string" ? record.token : undefined,
  };
}

export async function POST(request: Request) {
  return handleApiRequest(async () => {
    const body = validateBody(await request.json());
    const assessment = await findAssessmentForFunnel(body.assessmentSessionId);

    if (!assessment) {
      throw new AppError("assessment_not_found", "Assessment not found", 404);
    }

    if (body.token && body.token !== assessment.resultToken) {
      throw new AppError("report_access_denied", "Invalid token", 403);
    }

    if (body.type === "report_viewed") {
      const already = await hasFunnelEvent(
        body.assessmentSessionId,
        "report_viewed",
      );
      if (!already) {
        await createFunnelEvent({
          userId: assessment.userId,
          assessmentSessionId: body.assessmentSessionId,
          type: "report_viewed",
        });
        hookReportViewed(
          assessment.userId,
          body.assessmentSessionId,
          assessment.overallScore?.percentage,
        );
      }
    }

    if (body.type === "consultation_started" || body.type === "cta_clicked") {
      const eventType =
        body.type === "cta_clicked" ? "cta_clicked" : "consultation_started";
      const already = await hasFunnelEvent(
        body.assessmentSessionId,
        eventType === "cta_clicked" ? "cta_clicked" : "consultation_started",
      );
      if (!already) {
        await createFunnelEvent({
          userId: assessment.userId,
          assessmentSessionId: body.assessmentSessionId,
          type: eventType,
        });
      }
      if (body.type === "consultation_started") {
        hookConsultationStarted(assessment.userId, body.assessmentSessionId);
      }
    }

    return { ok: true };
  });
}
