import { prisma } from "../db";
import { NotFoundError, AuthorizationError, QuizAlreadyPublishedError } from "../utils/errors";
import { transitionQuestion } from "../state-machines";
import { QuestionStatus, QuestionSource, QuizStatus } from "@prisma/client";

export async function listQuestions(quizId: string, teacherId: string) {
  // Verify quiz ownership
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

  const questions = await prisma.questionBankItem.findMany({
    where: { quizId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  // FLAGGED_FOR_REVIEW items should appear first
  const sorted = [
    ...questions.filter((q) => q.status === QuestionStatus.FLAGGED_FOR_REVIEW),
    ...questions.filter((q) => q.status !== QuestionStatus.FLAGGED_FOR_REVIEW),
  ];

  return sorted;
}

export async function createQuestion(
  quizId: string,
  teacherId: string,
  input: {
    type: import("@prisma/client").QuestionType;
    content: Record<string, unknown>;
    status?: QuestionStatus;
    generationInstruction?: string;
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
    throw new QuizAlreadyPublishedError();
  }

  const question = await prisma.questionBankItem.create({
    data: {
      quizId,
      type: input.type,
      content: input.content as object,
      status: input.status ?? QuestionStatus.DRAFT,
      source: QuestionSource.MANUAL,
      generationInstruction: input.generationInstruction ?? null,
    },
  });

  return question;
}

export async function getQuestion(
  questionId: string,
  teacherId: string
) {
  const question = await prisma.questionBankItem.findUnique({
    where: { id: questionId },
    include: {
      quiz: {
        include: {
          lecture: {
            select: { class: { select: { teacherId: true } } },
          },
        },
      },
    },
  });

  if (!question) {
    throw new NotFoundError("Câu hỏi");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu câu hỏi này");
  }

  return question;
}

export async function updateQuestion(
  questionId: string,
  teacherId: string,
  input: {
    content?: Record<string, unknown>;
    status?: QuestionStatus;
    reviewNote?: string | null;
  }
) {
  const question = await prisma.questionBankItem.findUnique({
    where: { id: questionId },
    include: {
      quiz: {
        include: {
          lecture: {
            select: { class: { select: { teacherId: true } } },
          },
        },
      },
    },
  });

  if (!question) {
    throw new NotFoundError("Câu hỏi");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu câu hỏi này");
  }

  if (question.quiz.status === QuizStatus.PUBLISHED) {
    throw new QuizAlreadyPublishedError();
  }

  // Validate status transition
  if (input.status && input.status !== question.status) {
    transitionQuestion(question.status, input.status);
  }

  return prisma.questionBankItem.update({
    where: { id: questionId },
    data: {
      content: input.content !== undefined ? (input.content as object) : question.content,
      status: input.status ?? question.status,
      reviewNote: input.reviewNote !== undefined ? input.reviewNote : question.reviewNote,
    },
  });
}

export async function updateQuestionStatus(
  questionId: string,
  teacherId: string,
  newStatus: QuestionStatus
) {
  const question = await prisma.questionBankItem.findUnique({
    where: { id: questionId },
    include: {
      quiz: {
        include: {
          lecture: {
            select: { class: { select: { teacherId: true } } },
          },
        },
      },
    },
  });

  if (!question) {
    throw new NotFoundError("Câu hỏi");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu câu hỏi này");
  }

  transitionQuestion(question.status, newStatus);

  return prisma.questionBankItem.update({
    where: { id: questionId },
    data: { status: newStatus },
  });
}

export async function deleteQuestion(questionId: string, teacherId: string) {
  const question = await prisma.questionBankItem.findUnique({
    where: { id: questionId },
    include: {
      quiz: {
        include: {
          lecture: {
            select: { class: { select: { teacherId: true } } },
          },
        },
      },
    },
  });

  if (!question) {
    throw new NotFoundError("Câu hỏi");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu câu hỏi này");
  }

  if (question.quiz.status === QuizStatus.PUBLISHED) {
    throw new QuizAlreadyPublishedError();
  }

  await prisma.questionBankItem.delete({ where: { id: questionId } });
}

export async function bulkCreateQuestions(
  quizId: string,
  teacherId: string,
  questions: Array<{
    type: import("@prisma/client").QuestionType;
    content: Record<string, unknown>;
  }>
) {
  // Verify quiz ownership
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
    throw new QuizAlreadyPublishedError();
  }

  if (questions.length === 0) return [];

  const created = await prisma.questionBankItem.createMany({
    data: questions.map((q) => ({
      quizId,
      type: q.type,
      content: q.content as object,
      status: QuestionStatus.APPROVED,
      source: QuestionSource.UPLOADED,
    })),
  });

  return created;
}
