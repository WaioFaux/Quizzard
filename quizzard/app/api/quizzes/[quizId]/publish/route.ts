import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { PublishQuizSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { publishQuiz } from "@/lib/services/quiz.service";
import { logger } from "@/lib/utils/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();
    const body = await req.json().catch(() => ({}));

    const parsed = PublishQuizSchema.safeParse(body);

    const quiz = await publishQuiz(
      quizId,
      session.userId,
      parsed.success ? parsed.data.deadline : undefined
    );

    logger.info("quiz.publish", {
      userId: session.userId,
      quizId,
    });

    return Response.json({ data: quiz });
  } catch (err) {
    return handleApiError(err);
  }
}
