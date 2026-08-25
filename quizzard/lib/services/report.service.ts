import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";

export async function createReport(
  studentId: string,
  input: {
    studentAnswerId: string;
    description: string;
  }
) {
  // Verify the answer belongs to this student
  const answer = await prisma.studentAnswer.findUnique({
    where: { id: input.studentAnswerId },
    include: {
      attempt: {
        select: {
          studentId: true,
          status: true,
        },
      },
    },
  });

  if (!answer) {
    throw new NotFoundError("Answer");
  }

  if (answer.attempt.studentId !== studentId) {
    throw new AuthorizationError("This is not your answer");
  }

  if (answer.attempt.status !== "SUBMITTED" && answer.attempt.status !== "AUTO_SUBMITTED") {
    throw new AuthorizationError("Cannot report an answer from an unsubmitted attempt");
  }

  const report = await prisma.questionReport.create({
    data: {
      studentAnswerId: input.studentAnswerId,
      description: input.description,
      status: "PENDING",
    },
    include: {
      studentAnswer: {
        include: {
          questionBankItem: {
            select: {
              id: true,
              type: true,
              content: true,
            },
          },
          attempt: {
            select: {
              id: true,
              student: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  return report;
}

export async function listReports(teacherId: string) {
  // Get all reports for quizzes owned by this teacher
  const reports = await prisma.questionReport.findMany({
    where: {
      studentAnswer: {
        attempt: {
          quiz: {
            lecture: {
              class: {
                teacherId,
              },
            },
          },
        },
      },
    },
    include: {
      studentAnswer: {
        include: {
          questionBankItem: {
            select: {
              id: true,
              type: true,
              content: true,
            },
          },
          attempt: {
            select: {
              id: true,
              score: true,
              student: {
                select: { id: true, name: true },
              },
              quiz: {
                select: {
                  id: true,
                  lecture: {
                    select: {
                      title: true,
                      class: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports;
}

export async function updateReport(
  reportId: string,
  teacherId: string,
  input: {
    status?: "PENDING" | "RESOLVED" | "DISMISSED";
    reviewNote?: string | null;
  }
) {
  const report = await prisma.questionReport.findUnique({
    where: { id: reportId },
    include: {
      studentAnswer: {
        include: {
          attempt: {
            select: {
              quiz: {
                select: {
                  lecture: {
                    select: {
                      class: {
                        select: { teacherId: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!report) {
    throw new NotFoundError("Report");
  }

  if (report.studentAnswer.attempt.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this report");
  }

  return prisma.questionReport.update({
    where: { id: reportId },
    data: {
      status: input.status ?? report.status,
      reviewNote: input.reviewNote !== undefined ? input.reviewNote : report.reviewNote,
    },
  });
}
