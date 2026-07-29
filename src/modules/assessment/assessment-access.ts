import type { NextRequest } from "next/server";
import { extractAssessmentToken } from "@/lib/assessment-token";
import { readSessionsFromRequest } from "@/lib/session";
import type { ResultAccessInput } from "./assessment.types";

/** Token (header/query) + session cookies for assessment HTTP APIs. */
export function readAssessmentAccess(request: NextRequest): ResultAccessInput {
  return {
    token: extractAssessmentToken(request),
    ...readSessionsFromRequest(request),
  };
}
