import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { SaveAnswerSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { getAttempt, saveAnswer } from "@/lib/services/attempt.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const session = await requireStudent();

    const attempt = await getAttempt(attemptId, session.userId);

    return Response.json({ data: attempt });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const session = await requireStudent();
    const body = await req.json();

    const parsed = SaveAnswerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const attempt = await saveAnswer(
      attemptId,
      session.userId,
      parsed.data.answers.map((a) => ({
        questionBankItemId: a.questionBankItemId,
        answer: a.answer as import("@/lib/question-types/types").StudentAnswerValue,
      }))
    );

    return Response.json({ data: attempt });
  } catch (err) {
    return handleApiError(err);
  }
}
