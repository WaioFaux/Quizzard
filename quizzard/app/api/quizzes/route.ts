import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { CreateQuizSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { createQuiz } from "@/lib/services/quiz.service";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = CreateQuizSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const quiz = await createQuiz(session.userId, {
      lectureId: parsed.data.lectureId,
      instructions: parsed.data.instructions,
      questionsPerAttempt: parsed.data.questionsPerAttempt,
      timeLimitMinutes: parsed.data.timeLimitMinutes,
      deadline: parsed.data.deadline,
    });

    logger.info("quiz.create", {
      userId: session.userId,
      quizId: quiz.id,
      lectureId: parsed.data.lectureId,
    });

    return Response.json({ data: quiz }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
