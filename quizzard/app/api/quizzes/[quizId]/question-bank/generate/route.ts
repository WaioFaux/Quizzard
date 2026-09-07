import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { generateQuestionBank } from "@/lib/ai/generation.service";
import { getQuiz } from "@/lib/services/quiz.service";
import { logger } from "@/lib/utils/logger";
import { checkGenerationRateLimit } from "@/lib/middleware/rate-limit";
import { AppError } from "@/lib/utils/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();
    const body = await req.json().catch(() => ({}));

    const count = typeof body.count === "number" ? body.count : undefined;

    // Per-teacher rate limit: 5 AI generations per teacher per hour
    checkGenerationRateLimit(session.userId);

    const quiz = await getQuiz(quizId, session.userId);

    const result = await generateQuestionBank(quizId, session.userId, count);

    logger.info("quiz.questionBank.generate", {
      userId: session.userId,
      quizId,
      count: result.questions.length,
      usedFallback: result.usedFallback,
    });

    return Response.json({
      data: {
        questions: result.questions,
        count: result.questions.length,
        usedFallback: result.usedFallback,
      },
    });
  } catch (err) {
    if (err instanceof AppError && err.name === "RateLimitExceededError") {
      const retryAfterMs = (err as { retryAfterMs: number }).retryAfterMs;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return Response.json(
        { error: "AI generation rate limit exceeded. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }
    return handleApiError(err);
  }
}
