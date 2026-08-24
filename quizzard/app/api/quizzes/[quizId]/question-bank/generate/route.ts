import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import { AppError } from "@/lib/utils/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    await requireTeacher();

    // AI generation is not in Sprint 1 scope
    throw new AppError(
      "Question generation requires AI configuration. Set GEMINI_API_KEY and implement the AI pipeline for this endpoint.",
      "AI_NOT_CONFIGURED",
      501
    );
  } catch (err) {
    return handleApiError(err);
  }
}
