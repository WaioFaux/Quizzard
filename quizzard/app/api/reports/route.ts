import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listReports } from "@/lib/services/report.service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacher();

    const reports = await listReports(session.userId);

    return Response.json({
      data: reports,
      total: reports.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
