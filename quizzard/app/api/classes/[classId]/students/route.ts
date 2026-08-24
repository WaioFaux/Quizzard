import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listClassStudents } from "@/lib/services/class.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await requireTeacher();

    const students = await listClassStudents(classId, session.userId);

    return Response.json({
      data: students.map((e) => ({
        ...e.student,
        enrolledAt: e.joinedAt,
      })),
      total: students.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
