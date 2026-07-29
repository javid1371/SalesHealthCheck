/** Header preferred over query for assessment mutate/read APIs (ADR 0017). */
export const ASSESSMENT_TOKEN_HEADER = "x-assessment-token";

/**
 * Extract the assessment result token from `X-Assessment-Token` or `?token=`.
 * Header wins when both are present.
 */
export function extractAssessmentToken(request: Request): string | null {
  const header = request.headers.get(ASSESSMENT_TOKEN_HEADER)?.trim();
  if (header) {
    return header;
  }

  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (token) {
      return token;
    }
  } catch {
    // ignore malformed URL
  }

  return null;
}
