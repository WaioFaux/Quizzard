import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listTeacherClasses } from "@/lib/services/class.service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacher();

    const classes = await listTeacherClasses(session.userId);

    // Fetch analytics for each class in parallel
    const classAnalytics = await Promise.all(
      classes.map(async (cls) => {
        let enrollments: { studentId: string }[] = [];
        let attempts: unknown[] = [];
        let publishedQuizzes: { id: string; questionsPerAttempt: number }[] = [];
        try {
          [enrollments, attempts, publishedQuizzes] = await Promise.all([
            prisma.enrollment.findMany({
              where: { classId: cls.id },
              select: { studentId: true },
            }),
            prisma.studentAttempt.findMany({
              where: {
                quiz: {
                  lecture: { classId: cls.id },
                  status: "PUBLISHED",
                },
                status: "SUBMITTED",
              },
              select: {
                score: true,
                studentId: true,
                submittedAt: true,
                quiz: {
                  select: {
                    id: true,
                    lecture: { select: { title: true, classId: true } },
                  },
                },
              },
              orderBy: { submittedAt: "desc" },
              take: 20,
            }),
            prisma.quiz.findMany({
              where: {
                lecture: { classId: cls.id },
                status: "PUBLISHED",
              },
              select: {
                id: true,
                questionsPerAttempt: true,
              },
            }),
          ]);
        } catch (e) {
          console.error("Analytics query error for class", cls.id, e);
          throw e;
        }

        const studentCount = enrollments.length;
        const quizIds = publishedQuizzes.map((q) => q.id);

        const submittedAttempts = attempts.filter((a) => a.score !== null);
        const avgScore =
          submittedAttempts.length > 0
            ? submittedAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / submittedAttempts.length
            : null;

        // Completion rate = students who submitted at least once / total enrolled
        const studentsWhoAttempted = new Set(attempts.map((a) => a.studentId)).size;
        const completionRate =
          studentCount > 0 && quizIds.length > 0
            ? Math.min((studentsWhoAttempted / studentCount) * 100, 100)
            : 0;

        // Recent submissions
        const recentSubmissions = attempts.slice(0, 5).map((a) => ({
          studentId: a.studentId,
          studentName: "", // resolved below
          quizTitle: a.quiz.lecture.title,
          classId: a.quiz.lecture.classId,
          score: a.score,
          submittedAt: a.submittedAt.toISOString(),
               }));

        // Pending reports count for this class's quizzes
        let pendingReports = 0;
        if (quizIds.length > 0) {
          try {
            pendingReports = await prisma.questionReport.count({
              where: {
                status: "PENDING",
                studentAnswer: {
                  attempt: {
                    quizId: { in: quizIds },
                  },
                },
              },
            });
          } catch (e) {
            console.error("Pending reports count error for class", cls.id, e);
            throw e;
          }
        }

        return {
          classId: cls.id,
          className: cls.name,
          studentCount,
          quizCount: publishedQuizzes.length,
          avgScore,
          completionRate,
          pendingReports,
          recentSubmissions,
        };
      })
    );

    // Resolve student names for recent submissions
    const allRecentStudentIds = classAnalytics.flatMap((c) =>
      c.recentSubmissions.map((s) => s.studentId)
    );
    const uniqueIds = [...new Set(allRecentStudentIds)];

    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const enrichedAnalytics = classAnalytics.map((cls) => ({
      ...cls,
      recentSubmissions: cls.recentSubmissions.map((s) => ({
        ...s,
        studentName: userMap[s.studentId] ?? "Unknown",
      })),
    }));

    // Overall stats
    const totalStudents = classAnalytics.reduce((sum, c) => sum + c.studentCount, 0);
    const totalPendingReports = classAnalytics.reduce((sum, c) => sum + c.pendingReports, 0);
    const avgScoreValues = classAnalytics
      .map((c) => c.avgScore)
      .filter((v): v is number => v !== null);
    const overallAvgScore =
      avgScoreValues.length > 0
        ? avgScoreValues.reduce((sum, v) => sum + v, 0) / avgScoreValues.length
        : null;

    // Global recent submissions across all classes (last 10)
    const allRecent = enrichedAnalytics
      .flatMap((c) => c.recentSubmissions)
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
      .slice(0, 10);

    return Response.json({
      data: {
        overview: {
          totalClasses: classes.length,
          totalStudents,
          overallAvgScore,
          totalPendingReports,
        },
        classes: enrichedAnalytics,
        recentSubmissions: allRecent,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
