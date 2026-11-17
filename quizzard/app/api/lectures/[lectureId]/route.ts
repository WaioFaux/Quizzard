import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { deleteLecture, getLectureById } from "@/lib/services/lecture.service";
import { logger } from "@/lib/utils/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  try {
    const { lectureId } = await params;
    const session = await requireTeacher();

    const lecture = await getLectureById(lectureId);
    if (!lecture) {
      return Response.json({ error: "Không tìm thấy buổi giảng" }, { status: 404 });
    }

    await deleteLecture(lectureId, session.userId);

    logger.info("lecture.delete", {
      lectureId,
      userId: session.userId,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
