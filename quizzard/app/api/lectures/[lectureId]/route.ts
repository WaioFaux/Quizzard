import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { UpdateLectureSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import {
  getLecture,
  updateLecture,
  deleteLecture,
} from "@/lib/services/lecture.service";
import { logger } from "@/lib/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  try {
    const { lectureId } = await params;
    const session = await requireTeacher();

    const lecture = await getLecture(lectureId, session.userId);

    return Response.json({ data: lecture });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  try {
    const { lectureId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = UpdateLectureSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const lecture = await updateLecture(lectureId, session.userId, {
      title: parsed.data.title,
      sourceRef: parsed.data.sourceRef,
      order: parsed.data.order,
      materialId: parsed.data.materialId,
    });

    logger.info("lecture.update", {
      userId: session.userId,
      lectureId,
    });

    return Response.json({ data: lecture });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  try {
    const { lectureId } = await params;
    const session = await requireTeacher();

    await deleteLecture(lectureId, session.userId);

    logger.info("lecture.delete", {
      userId: session.userId,
      lectureId,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
