import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { prisma } from "@/lib/db";
import { AuthorizationError } from "@/lib/utils/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const session = await requireAuth();

    // Get class with enrollments and published quizzes
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          select: { studentId: true },
        },
        lectures: {
          select: {
            quiz: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!classData) {
      throw new AuthorizationError("Không tìm thấy lớp");
    }

    // Authorization
    if (session.role === "TEACHER" && classData.teacherId !== session.userId) {
      throw new AuthorizationError("Bạn không sở hữu lớp này");
    }
    if (
      session.role === "STUDENT" &&
      !classData.enrollments.some((e) => e.studentId === session.userId)
    ) {
      throw new AuthorizationError("Bạn chưa tham gia lớp này");
    }

    // Get all published quiz IDs
    const publishedQuizIds = classData.lectures
      .filter((l) => l.quiz?.status === "PUBLISHED")
      .map((l) => l.quiz!.id);

    if (publishedQuizIds.length === 0) {
      return Response.json({ data: [] });
    }

    // Get all submitted attempts grouped by student and quiz
    const attempts = await prisma.studentAttempt.findMany({
      where: {
        quizId: { in: publishedQuizIds },
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate best score per quiz per student
    const bestScoresMap = new Map<string, number>();
    
    for (const attempt of attempts) {
      const key = `${attempt.quizId}-${attempt.studentId}`;
      const currentBest = bestScoresMap.get(key) || 0;
      if (attempt.score > currentBest) {
        bestScoresMap.set(key, attempt.score);
      }
    }

    // Aggregate total scores by student
    const studentTotals = new Map<string, { studentId: string; studentName: string; totalScore: number; quizzesCompleted: number }>();

    for (const [key, bestScore] of bestScoresMap.entries()) {
      const [quizId, studentId] = key.split("-");
      const attempt = attempts.find(a => a.quizId === quizId && a.studentId === studentId);
      
      if (!studentTotals.has(studentId)) {
        studentTotals.set(studentId, {
          studentId,
          studentName: attempt?.student.name || "Unknown",
          totalScore: 0,
          quizzesCompleted: 0,
        });
      }
      
      const student = studentTotals.get(studentId)!;
      student.totalScore += bestScore;
      student.quizzesCompleted += 1;
    }

    // Sort by total score descending and add rank
    const leaderboard = Array.from(studentTotals.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, idx) => ({
        rank: idx + 1,
        studentId: entry.studentId,
        studentName: entry.studentName,
        score: entry.totalScore,
        quizzesCompleted: entry.quizzesCompleted,
        totalQuizzes: publishedQuizIds.length,
      }));

    return Response.json({ data: leaderboard });
  } catch (err) {
    return handleApiError(err);
  }
}
