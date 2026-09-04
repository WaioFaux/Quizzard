import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { getQuizForStudent } from "@/lib/services/quiz.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireStudent();

    const quiz = await getQuizForStudent(quizId, session.userId);

    return Response.json({ data: quiz });
  } catch (err) {
    return handleApiError(err);
  }
}
