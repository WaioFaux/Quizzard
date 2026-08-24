import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { JoinClassSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { joinClass } from "@/lib/services/class.service";
import { logger } from "@/lib/utils/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await requireStudent();
    const body = await req.json();

    const parsed = JoinClassSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // classId from URL should match classCode
    const enrollment = await joinClass(
      session.userId,
      parsed.data.classCode,
      parsed.data.classPassword
    );

    logger.info("class.join", {
      userId: session.userId,
      classId: enrollment.class.id,
    });

    return Response.json({ data: enrollment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
