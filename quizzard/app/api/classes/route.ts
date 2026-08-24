import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import {
  CreateClassSchema,
  PaginationSchema,
} from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import {
  createClass,
  listTeacherClasses,
} from "@/lib/services/class.service";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacher();

    const { searchParams } = new URL(req.url);
    const pagination = PaginationSchema.safeParse(searchParams);
    const page = pagination.data?.page ?? 1;
    const pageSize = pagination.data?.pageSize ?? 20;

    const classes = await listTeacherClasses(session.userId);

    return Response.json({
      data: classes,
      total: classes.length,
      page,
      pageSize,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const body = await req.json();

    const parsed = CreateClassSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const cls = await createClass(session.userId, parsed.data);

    logger.info("class.create", { userId: session.userId, classId: cls.id });

    return Response.json({ data: cls }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
