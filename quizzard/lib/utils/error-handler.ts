import { AppError } from "./errors";
import { logger } from "./logger";

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Log full detail server-side
  if (error instanceof Error) {
    logger.error("unhandled_error", {
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.error("unhandled_error", { error: String(error) });
  }

  return Response.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}
