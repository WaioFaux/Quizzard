import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ExtendDeadlineSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { extendDeadline } from "@/lib/services/quiz.service";
import { logger } from "@/lib/utils/logger";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = ExtendDeadlineSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const quiz = await extendDeadline(
      quizId,
      session.userId,
      parsed.data.deadline
    );

    logger.info("quiz.extend_deadline", {
      userId: session.userId,
      quizId,
      newDeadline: parsed.data.deadline,
    });

    return Response.json({ data: quiz });
  } catch (err) {
    return handleApiError(err);
  }
}
