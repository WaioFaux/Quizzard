import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  CreateLectureSchema,
} from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import {
  createLecture,
  listLectures,
  proposeLecturesFromMaterial,
} from "@/lib/services/lecture.service";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const { searchParams } = new URL(req.url);

    const classId = searchParams.get("classId");
    if (!classId) {
      throw new ValidationError("Cần có tham số classId");
    }

    const lectures = await listLectures(classId, session.userId);

    return Response.json({ data: lectures, total: lectures.length });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const body = await req.json();

    // If propose=true, this is an AI lecture proposal request
    if (body.propose === true) {
      const { classId, materialId } = body;

      if (!classId || typeof classId !== "string") {
        throw new ValidationError("Cần có classId để đề xuất buổi giảng");
      }
      if (!materialId || typeof materialId !== "string") {
        throw new ValidationError("Cần có materialId để đề xuất buổi giảng");
      }

      const proposals = await proposeLecturesFromMaterial(classId, session.userId, materialId);

      logger.info("lecture.propose", {
        userId: session.userId,
        classId,
        materialId,
        proposalCount: proposals.length,
      });

      return Response.json({ data: proposals }, { status: 200 });
    }

    const parsed = CreateLectureSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const lecture = await createLecture(parsed.data.classId, session.userId, {
      title: parsed.data.title,
      sourceRef: parsed.data.sourceRef,
      materialId: parsed.data.materialId,
    });

    logger.info("lecture.create", {
      userId: session.userId,
      lectureId: lecture.id,
      classId: parsed.data.classId,
    });

    return Response.json({ data: lecture }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
