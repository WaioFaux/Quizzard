import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  CreateQuestionSchema,
  PaginationSchema,
} from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { listQuestions, createQuestion } from "@/lib/services/question-bank.service";
import { logger } from "@/lib/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();

    const questions = await listQuestions(quizId, session.userId);

    return Response.json({ data: questions, total: questions.length });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = CreateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // Build content from parsed data
    const content = parsed.data.content;

    const question = await createQuestion(quizId, session.userId, {
      type: parsed.data.type,
      content: content as Record<string, unknown>,
      status: parsed.data.status,
      generationInstruction: parsed.data.generationInstruction,
    });

    logger.info("question_bank.create", {
      userId: session.userId,
      quizId,
      questionId: question.id,
      type: question.type,
    });

    return Response.json({ data: question }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
