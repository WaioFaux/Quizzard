import { prisma } from "../db";
import {
  generateSampleQuestions,
  generateFullQuestionBank,
  blindRecheck,
  type GeneratedQuestion,
} from "./gemini-client";
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
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
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
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu bài kiểm tra này");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Không thể chỉnh sửa bài kiểm tra đã xuất bản");
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

  // The blind recheck is an independent AI call per question. Running them
  // sequentially would multiply the provider latency by the number of
  // questions and can blow the serverless function budget, so they run
  // concurrently instead.
  const recheckResults = await Promise.all(
    result.questions.map((question) => blindRecheck(question))
  );

  for (let i = 0; i < result.questions.length; i++) {
    const question = result.questions[i];
    const recheck = recheckResults[i];
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
