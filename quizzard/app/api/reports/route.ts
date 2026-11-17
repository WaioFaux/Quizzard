import { NextRequest } from "next/server";
import { requireTeacher, requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listReports, createReport } from "@/lib/services/report.service";
import { CreateReportSchema } from "@/lib/validation/schemas";
import { ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

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

/**
 * Submit a report about one of the student's own answers.
 *
 * The student results screen posts here when the student marks a question
 * as wrong. The route used to export only GET, so the request was answered
 * with 405 "Method Not Allowed" before it ever reached this handler.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireStudent();
    const body = await req.json();

    const parsed = CreateReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Dữ liệu báo cáo không hợp lệ"
      );
    }

    const report = await createReport(session.userId, parsed.data);

    logger.info("report.created", {
      studentId: session.userId,
      reportId: report.id,
      studentAnswerId: parsed.data.studentAnswerId,
      status: report.status,
    });

    // #region agent log
    fetch("http://127.0.0.1:7643/ingest/0cb14382-f394-4521-a685-f858a9d2a5ea", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f207dd",
      },
      body: JSON.stringify({
        sessionId: "f207dd",
        runId: "post-fix",
        hypothesisId: "H1",
        location: "app/api/reports/route.ts:POST",
        message: "Report created",
        data: {
          reportId: report.id,
          studentAnswerId: parsed.data.studentAnswerId,
          descriptionLength: parsed.data.description.length,
          status: report.status,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return Response.json(
      {
        data: {
          id: report.id,
          status: report.status,
          createdAt: report.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
