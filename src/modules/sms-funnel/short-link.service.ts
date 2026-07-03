import { randomBytes } from "node:crypto";
import type { ShortLinkPurpose } from "@prisma/client";
import { env } from "@/lib/env";
import { buildShortLinkUrl } from "./branding";
import { createShortLink } from "./funnel.repository";

function generateSlug(): string {
  return randomBytes(6).toString("base64url").slice(0, 10);
}

export function buildAssessmentTargetUrl(input: {
  purpose: ShortLinkPurpose;
  assessmentSessionId?: string;
  resultToken?: string;
  reportId?: string;
}): string {
  const base = env.appBaseUrl.replace(/\/$/, "");

  switch (input.purpose) {
    case "start":
      return `${base}/assessment/start`;
    case "continue_assessment": {
      if (!input.assessmentSessionId || !input.resultToken) {
        return `${base}/assessment/start`;
      }
      return `${base}/assessment/${input.assessmentSessionId}/questions/0?token=${encodeURIComponent(input.resultToken)}`;
    }
    case "result": {
      if (!input.assessmentSessionId || !input.resultToken) {
        return `${base}/assessment/start`;
      }
      return `${base}/assessment/${input.assessmentSessionId}/result?token=${encodeURIComponent(input.resultToken)}`;
    }
    case "consultation": {
      if (!input.assessmentSessionId || !input.resultToken) {
        return `${base}/assessment/start`;
      }
      const params = new URLSearchParams({
        token: input.resultToken,
      });
      if (input.reportId) {
        params.set("reportId", input.reportId);
      }
      return `${base}/assessment/${input.assessmentSessionId}/cta?${params.toString()}`;
    }
    default:
      return `${base}/assessment/start`;
  }
}

export async function createTrackedShortLink(input: {
  purpose: ShortLinkPurpose;
  userId?: string;
  assessmentSessionId?: string;
  resultToken?: string;
  reportId?: string;
}): Promise<string> {
  const targetUrl = buildAssessmentTargetUrl({
    purpose: input.purpose,
    assessmentSessionId: input.assessmentSessionId,
    resultToken: input.resultToken,
    reportId: input.reportId,
  });

  let slug = generateSlug();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await createShortLink({
        slug,
        targetUrl,
        userId: input.userId,
        assessmentSessionId: input.assessmentSessionId,
        purpose: input.purpose,
      });
      return buildShortLinkUrl(slug);
    } catch {
      slug = generateSlug();
    }
  }

  throw new Error("Failed to create short link");
}
