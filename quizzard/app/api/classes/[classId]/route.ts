import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { UpdateClassSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import {
  getClassById,
  updateClass,
  deleteClass,
} from "@/lib/services/class.service";
import { logger } from "@/lib/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await requireAuth();

    const cls = await getClassById(classId, session.userId, session.role);

    return Response.json({ data: cls });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await requireAuth();

    if (session.role !== "TEACHER") {
      return Response.json(
        { error: "Only teachers can update classes", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = UpdateClassSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const cls = await updateClass(classId, session.userId, parsed.data);

    logger.info("class.update", { userId: session.userId, classId: cls.id });

    return Response.json({ data: cls });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await requireAuth();

    if (session.role !== "TEACHER") {
      return Response.json(
        { error: "Only teachers can delete classes", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    await deleteClass(classId, session.userId);

    logger.info("class.delete", { userId: session.userId, classId });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
