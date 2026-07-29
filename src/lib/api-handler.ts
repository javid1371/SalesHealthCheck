import * as Sentry from "@sentry/nextjs";
import { AppError, errorResponse, isAppError } from "@/lib/errors";

export type HandleApiRequestOptions<T> = {
  /** Optional status code derived from a successful result (e.g. 202 for queued). */
  statusFor?: (result: T) => number;
};

export async function handleApiRequest<T>(
  handler: () => Promise<T>,
  options?: HandleApiRequestOptions<T>,
): Promise<Response> {
  try {
    const result = await handler();
    const status = options?.statusFor?.(result) ?? 200;
    return Response.json(result, { status });
  } catch (error) {
    if (isAppError(error)) {
      return errorResponse(error);
    }

    console.error("Unhandled API error:", error);
    Sentry.captureException(error);

    return errorResponse(
      new AppError(
        "INTERNAL_ERROR",
        "An unexpected error occurred",
        500,
      ),
    );
  }
}
