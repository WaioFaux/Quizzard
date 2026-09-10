import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listStudentEnrollments } from "@/lib/services/class.service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireStudent();

    const [enrollments, attempts] = await Promise.all([
      listStudentEnrollments(session.userId),
      prisma.studentAttempt.findMany({
        where: { studentId: session.userId },
        select: {
          id: true,
          quizId: true,
          score: true,
          status: true,
          submittedAt: true,
          quiz: {
            select: {
              id: true,
              status: true,
              deadline: true,
              timeLimitMinutes: true,
              questionsPerAttempt: true,
              lecture: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  classId: true,
                  class: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      }),
    ]);

    // Build set of quiz IDs the student has attempted
    const attemptedQuizIds = new Set(attempts.map((a) => a.quizId));

    // Stats
    const completedAttempts = attempts.filter((a) => a.status === "SUBMITTED" && a.score !== null);
    const overallAvg =
      completedAttempts.length > 0
        ? completedAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / completedAttempts.length
        : null;

    return Response.json({
      data: {
        stats: {
          classesEnrolled: enrollments.length,
          quizzesCompleted: completedAttempts.length,
          overallAverage: overallAvg,
        },
        enrollments,
        attempts,
        attemptedQuizIds: Array.from(attemptedQuizIds),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
