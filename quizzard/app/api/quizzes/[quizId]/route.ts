import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { UpdateQuizSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { getQuiz, updateQuiz } from "@/lib/services/quiz.service";
import { logger } from "@/lib/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();

    const quiz = await getQuiz(quizId, session.userId);

    return Response.json({ data: quiz });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = UpdateQuizSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const quiz = await updateQuiz(quizId, session.userId, {
      instructions: parsed.data.instructions,
      questionsPerAttempt: parsed.data.questionsPerAttempt,
      timeLimitMinutes: parsed.data.timeLimitMinutes,
    });

    logger.info("quiz.update", {
      userId: session.userId,
      quizId,
    });

    return Response.json({ data: quiz });
  } catch (err) {
    return handleApiError(err);
  }
}
