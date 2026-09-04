import { AppError } from "./errors";
import { logger } from "./logger";

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === "development";

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Log full detail server-side
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (error instanceof Error) {
    logger.error("unhandled_error", {
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.error("unhandled_error", { error: String(error) });
  }

  // In development, return more details so we can debug
  // In production, return generic message for security
  if (isDevelopment) {
    console.error("[Error Handler] Full error details:", {
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
    
    return Response.json(
      { 
        error: errorMessage,
        details: errorStack,
        hint: "Check server console for full stack trace"
      },
      { status: 500 }
    );
  }

  return Response.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}
