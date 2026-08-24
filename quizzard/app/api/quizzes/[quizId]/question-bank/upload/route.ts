import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { AppError } from "@/lib/utils/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    await requireTeacher();

    // File upload processing is not in Sprint 1 scope
    throw new AppError(
      "Question bank file upload requires implementation.",
      "UPLOAD_NOT_IMPLEMENTED",
      501
    );
  } catch (err) {
    return handleApiError(err);
  }
}
