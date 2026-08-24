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
    throw new NotFoundError("Quiz");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this quiz");
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
    throw new NotFoundError("Quiz");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this quiz");
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
    throw new NotFoundError("Question");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this question");
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
    throw new NotFoundError("Question");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this question");
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
    throw new NotFoundError("Question");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this question");
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
    throw new NotFoundError("Question");
  }

  if (question.quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this question");
  }

  if (question.quiz.status === QuizStatus.PUBLISHED) {
    throw new QuizAlreadyPublishedError();
  }

  await prisma.questionBankItem.delete({ where: { id: questionId } });
}
