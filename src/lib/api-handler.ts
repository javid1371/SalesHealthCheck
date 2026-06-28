import * as Sentry from "@sentry/nextjs";
import { AppError, errorResponse, isAppError } from "@/lib/errors";

export async function handleApiRequest<T>(
  handler: () => Promise<T>,
): Promise<Response> {
  try {
    const result = await handler();
    return Response.json(result);
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
