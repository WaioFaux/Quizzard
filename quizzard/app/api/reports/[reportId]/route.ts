import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { updateReport } from "@/lib/services/report.service";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const session = await requireTeacher();
    const body = await req.json();

    const report = await updateReport(reportId, session.userId, {
      status: body.status,
      reviewNote: body.reviewNote,
    });

    return Response.json({ data: report });
  } catch (err) {
    return handleApiError(err);
  }
}
