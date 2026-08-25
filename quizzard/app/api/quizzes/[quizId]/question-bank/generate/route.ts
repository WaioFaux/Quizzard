import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { generateQuestionBank } from "@/lib/ai/generation.service";
import { getQuiz } from "@/lib/services/quiz.service";
import { logger } from "@/lib/utils/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();
    const body = await req.json().catch(() => ({}));

    const count = typeof body.count === "number" ? body.count : undefined;

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
    return handleApiError(err);
  }
}
