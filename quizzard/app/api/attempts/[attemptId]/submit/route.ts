import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { SubmitAttemptSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { submitAttempt } from "@/lib/services/attempt.service";
import { logger } from "@/lib/utils/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const session = await requireStudent();
    const body = await req.json();

    const parsed = SubmitAttemptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const attempt = await submitAttempt(
      attemptId,
      session.userId,
      parsed.data.answers.map((a) => ({
        questionBankItemId: a.questionBankItemId,
        answer: a.answer as import("@/lib/question-types/types").StudentAnswerValue,
      }))
    );

    logger.info("attempt.submit", {
      userId: session.userId,
      attemptId,
      score: attempt.score,
    });

    return Response.json({
      data: {
        attemptId: attempt.id,
        score: attempt.score,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
