import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listTeacherClasses } from "@/lib/services/class.service";
import { prisma } from "@/lib/db";

interface ClassLeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  totalScore: number;
  quizzesCompleted: number;
  totalQuizzes: number;
}

interface QuizLeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
}

interface QuizWithLeaderboard {
  quizId: string;
  quizTitle: string;
  classId: string;
  className: string;
  lectureOrder: number;
  totalParticipants: number;
  leaderboard: QuizLeaderboardEntry[];
}

interface ClassWithLeaderboard {
  classId: string;
  className: string;
  totalQuizzes: number;
  totalParticipants: number;
  leaderboard: ClassLeaderboardEntry[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all"; // "all", "classes", "quizzes"

    const classes = await listTeacherClasses(session.userId);

    if (classes.length === 0) {
      return Response.json({
        data: {
          classLeaderboards: [],
          quizLeaderboards: [],
        },
      });
    }

    const classIds = classes.map((c) => c.id);

    // Fetch all published quizzes for teacher's classes
    const publishedQuizzes = await prisma.quiz.findMany({
      where: {
        lecture: {
          classId: { in: classIds },
        },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        lecture: {
          select: {
            title: true,
            order: true,
            classId: true,
            class: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Get all attempts for published quizzes
    const quizIds = publishedQuizzes.map((q) => q.id);
    const attempts = await prisma.studentAttempt.findMany({
      where: {
        quizId: { in: quizIds },
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
      },
    });

    const classLeaderboards: ClassWithLeaderboard[] = [];
    const quizLeaderboards: QuizWithLeaderboard[] = [];

    // Process each class
    for (const cls of classes) {
      const classQuizzes = publishedQuizzes.filter(
        (q) => q.lecture.classId === cls.id
      );
      const classQuizIds = classQuizzes.map((q) => q.id);
      const classAttempts = attempts.filter((a) =>
        classQuizIds.includes(a.quizId)
      );

      // Calculate best score per quiz per student
      const bestScoresMap = new Map<string, number>();

      for (const attempt of classAttempts) {
        const key = `${attempt.quizId}-${attempt.studentId}`;
        const currentBest = bestScoresMap.get(key) || 0;
        if (attempt.score > currentBest) {
          bestScoresMap.set(key, attempt.score);
        }
      }

      // Aggregate total scores by student
      const studentTotals = new Map<
        string,
        {
          studentId: string;
          studentName: string;
          totalScore: number;
          quizzesCompleted: number;
        }
      >();

      for (const [key, bestScore] of bestScoresMap.entries()) {
        const [quizId, studentId] = key.split("-");
        const attempt = classAttempts.find(
          (a) => a.quizId === quizId && a.studentId === studentId
        );

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

      // Sort and rank
      const leaderboard = Array.from(studentTotals.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((entry, idx) => ({
          rank: idx + 1,
          studentId: entry.studentId,
          studentName: entry.studentName,
          totalScore: entry.totalScore,
          quizzesCompleted: entry.quizzesCompleted,
          totalQuizzes: classQuizzes.length,
        }));

      classLeaderboards.push({
        classId: cls.id,
        className: cls.name,
        totalQuizzes: classQuizzes.length,
        totalParticipants: studentTotals.size,
        leaderboard,
      });

      // Process each quiz for quiz leaderboards
      for (const quiz of classQuizzes) {
        const quizAttempts = classAttempts.filter(
          (a) => a.quizId === quiz.id
        );

        // Best score per student
        const studentBestScores = new Map<string, { name: string; score: number; studentId: string }>();

        for (const attempt of quizAttempts) {
          const existing = studentBestScores.get(attempt.studentId);
          if (!existing || attempt.score > existing.score) {
            studentBestScores.set(attempt.studentId, {
              studentId: attempt.studentId,
              name: attempt.student.name,
              score: attempt.score,
            });
          }
        }

        const quizLeaderboard = Array.from(studentBestScores.values())
          .sort((a, b) => b.score - a.score)
          .map((entry, idx) => ({
            rank: idx + 1,
            studentId: entry.studentId,
            studentName: entry.name,
            score: entry.score,
          }));

        quizLeaderboards.push({
          quizId: quiz.id,
          quizTitle: quiz.lecture.title,
          classId: quiz.lecture.classId,
          className: quiz.lecture.class.name,
          lectureOrder: quiz.lecture.order,
          totalParticipants: studentBestScores.size,
          leaderboard: quizLeaderboard,
        });
      }
    }

    // Sort quiz leaderboards by class name and lecture order
    quizLeaderboards.sort((a, b) => {
      if (a.className !== b.className) {
        return a.className.localeCompare(b.className);
      }
      return a.lectureOrder - b.lectureOrder;
    });

    return Response.json({
      data: {
        classLeaderboards: type === "quizzes" ? [] : classLeaderboards,
        quizLeaderboards: type === "classes" ? [] : quizLeaderboards,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
