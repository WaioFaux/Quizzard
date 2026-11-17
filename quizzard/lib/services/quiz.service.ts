import { prisma } from "../db";
import { NotFoundError, AuthorizationError, DeadlinePassedError, QuizNotPublishedError } from "../utils/errors";
import { transitionQuiz } from "../state-machines";
import { QuizStatus } from "@prisma/client";

export async function createQuiz(
  teacherId: string,
  input: {
    lectureId: string;
    instructions: string;
    questionsPerAttempt: number;
    timeLimitMinutes: number;
    deadline?: string | null;
  }
) {
  // Verify lecture ownership via class
  const lecture = await prisma.lecture.findUnique({
    where: { id: input.lectureId },
    include: {
      class: { select: { teacherId: true } },
      quiz: true,
    },
  });

  if (!lecture) {
    throw new NotFoundError("Buổi giảng");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu buổi giảng này");
  }

  if (lecture.quiz) {
    throw new AuthorizationError("Buổi giảng này đã có bài kiểm tra");
  }

  const quiz = await prisma.quiz.create({
    data: {
      lectureId: input.lectureId,
      instructions: input.instructions,
      questionsPerAttempt: input.questionsPerAttempt,
      timeLimitMinutes: input.timeLimitMinutes,
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: QuizStatus.DRAFT,
    },
    include: {
      lecture: {
        select: {
          id: true,
          title: true,
          class: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: { questionBank: true },
      },
    },
  });

  return quiz;
}

export async function getQuiz(quizId: string, teacherId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          id: true,
          title: true,
          class: {
            select: { id: true, teacherId: true },
          },
        },
      },
      _count: {
        select: {
          questionBank: true,
          attempts: true,
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
  }

  return quiz;
}

export async function updateQuiz(
  quizId: string,
  teacherId: string,
  input: {
    instructions?: string;
    questionsPerAttempt?: number;
    timeLimitMinutes?: number;
  }
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: { class: { select: { teacherId: true } } },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError(
      "Không thể cập nhật bài kiểm tra đã xuất bản. Chỉ được phép gia hạn thời hạn."
    );
  }

  return prisma.quiz.update({
    where: { id: quizId },
    data: {
      instructions: input.instructions ?? quiz.instructions,
      questionsPerAttempt: input.questionsPerAttempt ?? quiz.questionsPerAttempt,
      timeLimitMinutes: input.timeLimitMinutes ?? quiz.timeLimitMinutes,
    },
  });
}

export async function publishQuiz(
  quizId: string,
  teacherId: string,
  deadline?: string | null
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: { class: { select: { teacherId: true } } },
      },
      _count: {
        select: {
          questionBank: {
            where: { status: "APPROVED" },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
  }

  transitionQuiz(quiz.status, QuizStatus.PUBLISHED);

  // Validate all questions are approved before publishing
  const allQuestions = await prisma.questionBankItem.count({
    where: { quizId },
  });

  if (allQuestions > 0 && quiz._count.questionBank < allQuestions) {
    throw new AuthorizationError(
      "Tất cả câu hỏi phải được duyệt trước khi xuất bản bài kiểm tra"
    );
  }

  const publishedQuiz = await prisma.quiz.update({
    where: { id: quizId },
    data: {
      status: QuizStatus.PUBLISHED,
      publishedAt: new Date(),
      deadline: deadline ? new Date(deadline) : quiz.deadline,
    },
  });

  return publishedQuiz;
}

export async function extendDeadline(
  quizId: string,
  teacherId: string,
  newDeadline: string
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: { class: { select: { teacherId: true } } },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
  }

  if (quiz.status !== QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Chỉ bài kiểm tra đã xuất bản mới có hạn chót");
  }

  const currentDeadline = quiz.deadline ? new Date(quiz.deadline) : null;
  const proposedDeadline = new Date(newDeadline);

  // Can only extend, not shorten (unless no deadline set)
  if (currentDeadline && proposedDeadline < currentDeadline) {
    throw new AuthorizationError("Không thể rút ngắn hạn chót hiện tại");
  }

  return prisma.quiz.update({
    where: { id: quizId },
    data: { deadline: proposedDeadline },
  });
}

export async function getQuizForStudent(quizId: string, studentId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          id: true,
          title: true,
          class: {
            select: {
              id: true,
              name: true,
              enrollments: {
                where: { studentId },
                select: { studentId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  // Check if student is enrolled in the class
  const isEnrolled = quiz.lecture.class.enrollments.length > 0;
  if (!isEnrolled) {
    throw new AuthorizationError("Bạn chưa tham gia lớp này");
  }

  return quiz;
}

export async function getLeaderboard(
  quizId: string,
  userId: string,
  userRole: "TEACHER" | "STUDENT"
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          id: true,
          classId: true,
          class: {
            select: {
              teacherId: true,
              enrollments: {
                select: { studentId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  // Authorization
  if (userRole === "TEACHER" && quiz.lecture.class.teacherId !== userId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
  }
  if (
    userRole === "STUDENT" &&
    !quiz.lecture.class.enrollments.some((e) => e.studentId === userId)
  ) {
    throw new AuthorizationError("Bạn chưa tham gia lớp này");
  }

  // Get all attempts for this quiz
  const attempts = await prisma.studentAttempt.findMany({
    where: {
      quizId,
      status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
    },
    include: {
      student: {
        select: { id: true, name: true },
      },
    },
    orderBy: { score: "desc" },
  });

  return attempts.map((a, idx) => ({
    rank: idx + 1,
    studentId: a.student.id,
    studentName: a.student.name,
    score: a.score,
    submittedAt: a.submittedAt,
  }));
}
