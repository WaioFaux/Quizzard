import { prisma } from "../db";
import {
  generateSampleQuestions,
  generateFullQuestionBank,
  blindRecheck,
  type GeneratedQuestion,
} from "./gemini-client";
import { updateMaterialStatus } from "./material.service";
import { createLecture } from "./lecture.service";
import { createQuiz } from "./quiz.service";
import { createQuestion } from "./question-bank.service";
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

export async function createLecturesFromProposals(
  classId: string,
  teacherId: string,
  materialId: string,
  proposals: Array<{ title: string; startPage: number; endPage: number }>
) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!cls) {
    throw new NotFoundError("Class");
  }

  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  const results = [];
  for (const proposal of proposals) {
    const lecture = await createLecture(classId, teacherId, {
      title: proposal.title,
      sourceRef: {
        materialId,
        startPage: proposal.startPage,
        endPage: proposal.endPage,
      },
      materialId,
    });

    const quiz = await createQuiz(teacherId, {
      lectureId: lecture.id,
      instructions:
        "Generate questions covering the key concepts from this lecture.",
      questionsPerAttempt: 5,
      timeLimitMinutes: 30,
    });

    results.push({ lectureId: lecture.id, quizId: quiz.id });
  }

  await updateMaterialStatus(materialId, "PROCESSED");

  return results;
}
