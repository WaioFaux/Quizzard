import { prisma } from "../db";
import {
  generateSampleQuestions,
  generateFullQuestionBank,
  blindRecheck,
  type GeneratedQuestion,
} from "./gemini-client";
import { createQuiz } from "./quiz.service";
import { createQuestion } from "../services/question-bank.service";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { QuestionStatus, QuizStatus } from "@prisma/client";

export interface SampleGenerationResult {
  questions: GeneratedQuestion[];
  usedFallback: boolean;
}

export async function generateSample(
  quizId: string,
  teacherId: string,
  instructions: string
): Promise<SampleGenerationResult> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          class: { select: { teacherId: true } },
          material: { select: { extractedText: true } },
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Quiz");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this quiz");
  }

  const result = await generateSampleQuestions(instructions, 3);
  return result;
}

export async function generateQuestionBank(
  quizId: string,
  teacherId: string,
  count?: number
): Promise<{ questions: GeneratedQuestion[]; usedFallback: boolean }> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          class: { select: { teacherId: true } },
          material: { select: { extractedText: true } },
        },
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
    throw new AuthorizationError("Cannot modify a published quiz");
  }

  const poolSize = count ?? quiz.questionsPerAttempt * 5;
  const materialText = quiz.lecture.material?.extractedText ?? undefined;

  const result = await generateFullQuestionBank(
    quizId,
    quiz.instructions,
    poolSize,
    materialText
  );

  const createdQuestions = [];
  for (const question of result.questions) {
    const recheck = await blindRecheck(question);
    const status: QuestionStatus = recheck.flagged
      ? QuestionStatus.FLAGGED_FOR_REVIEW
      : QuestionStatus.DRAFT;

    const dbQuestion = await createQuestion(quizId, teacherId, {
      type: question.type,
      content: question as object,
      status,
    });
    createdQuestions.push(dbQuestion);
  }

  return { questions: result.questions, usedFallback: result.usedFallback };
}
