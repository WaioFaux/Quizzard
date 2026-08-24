import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { StartAttemptSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { startAttempt } from "@/lib/services/attempt.service";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await requireStudent();
    const body = await req.json();

    const parsed = StartAttemptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const attempt = await startAttempt(session.userId, parsed.data.quizId);

    logger.info("attempt.start", {
      userId: session.userId,
      attemptId: attempt.id,
      quizId: parsed.data.quizId,
    });

    return Response.json({ data: attempt }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
