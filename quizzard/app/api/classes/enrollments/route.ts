import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listStudentEnrollments } from "@/lib/services/class.service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireStudent();

    const enrollments = await listStudentEnrollments(session.userId);

    return Response.json({
      data: enrollments,
      total: enrollments.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
