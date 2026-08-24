import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { UpdateQuestionStatusSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { updateQuestionStatus } from "@/lib/services/question-bank.service";
import { logger } from "@/lib/utils/logger";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = UpdateQuestionStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const question = await updateQuestionStatus(
      itemId,
      session.userId,
      parsed.data.status
    );

    logger.info("question_bank.status_update", {
      userId: session.userId,
      questionId: itemId,
      newStatus: parsed.data.status,
    });

    return Response.json({ data: question });
  } catch (err) {
    return handleApiError(err);
  }
}
