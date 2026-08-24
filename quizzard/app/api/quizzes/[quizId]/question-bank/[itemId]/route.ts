import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { UpdateQuestionSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import {
  getQuestion,
  updateQuestion,
  deleteQuestion,
} from "@/lib/services/question-bank.service";
import { logger } from "@/lib/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const session = await requireTeacher();

    const question = await getQuestion(itemId, session.userId);

    return Response.json({ data: question });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = UpdateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const question = await updateQuestion(itemId, session.userId, {
      content: parsed.data.content as Record<string, unknown>,
      status: parsed.data.status,
      reviewNote: parsed.data.reviewNote,
    });

    logger.info("question_bank.update", {
      userId: session.userId,
      questionId: itemId,
    });

    return Response.json({ data: question });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const session = await requireTeacher();

    await deleteQuestion(itemId, session.userId);

    logger.info("question_bank.delete", {
      userId: session.userId,
      questionId: itemId,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
