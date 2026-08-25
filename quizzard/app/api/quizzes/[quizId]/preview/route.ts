import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { generateSample } from "@/lib/ai/generation.service";
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

    const instructions =
      typeof body.instructions === "string" && body.instructions.length > 0
        ? body.instructions
        : undefined;

    const quiz = await getQuiz(quizId, session.userId);

    const result = await generateSample(
      quizId,
      session.userId,
      instructions ?? quiz.instructions
    );

    logger.info("quiz.preview", {
      userId: session.userId,
      quizId,
      usedFallback: result.usedFallback,
    });

    return Response.json({
      data: {
        questions: result.questions,
        usedFallback: result.usedFallback,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
