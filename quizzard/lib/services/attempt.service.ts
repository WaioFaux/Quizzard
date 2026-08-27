import { createHash } from "crypto";
import { prisma } from "../db";
import {
  NotFoundError,
  AuthorizationError,
  DeadlinePassedError,
  AttemptInProgressError,
  QuizNotPublishedError,
} from "../utils/errors";
import { transitionAttempt } from "../state-machines";
import { getStrategy } from "../question-types";
import {
  QuestionContent,
  StudentAnswerValue,
  CorrectAnswerSnapshot,
  MCQContent,
  ShortAnswerContent,
  CalculationContent,
} from "../question-types/types";
import { QuizStatus, AttemptStatus } from "@prisma/client";

// Deterministic seeded shuffle using Fisher-Yates with seeded random
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let seedNum = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  
  for (let i = result.length - 1; i > 0; i--) {
    seedNum = (seedNum * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seedNum) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

function hashSeed(studentId: string, quizId: string): string {
  return createHash("sha256").update(`${studentId}:${quizId}`).digest("hex").slice(0, 16);
}

export async function startAttempt(studentId: string, quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          class: {
            select: {
              enrollments: {
                select: { studentId: true },
              },
            },
          },
        },
      },
      questionBank: {
        where: { status: "APPROVED" },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Quiz");
  }

  // Check student is enrolled
  const isEnrolled = quiz.lecture.class.enrollments.some(
    (e) => e.studentId === studentId
  );
  if (!isEnrolled) {
    throw new AuthorizationError("You are not enrolled in this class");
  }

  // Check quiz is published
  if (quiz.status !== QuizStatus.PUBLISHED) {
    throw new QuizNotPublishedError();
  }

  // Check deadline
  if (quiz.deadline && new Date(quiz.deadline) < new Date()) {
    throw new DeadlinePassedError();
  }

  // Check no existing attempt
  const existingAttempt = await prisma.studentAttempt.findUnique({
    where: {
      quizId_studentId: { quizId, studentId },
    },
  });

  if (existingAttempt) {
    if (existingAttempt.status === AttemptStatus.IN_PROGRESS) {
      throw new AttemptInProgressError();
    }
    throw new AuthorizationError("You have already completed this quiz");
  }

  // Draw N random questions from APPROVED pool
  const poolSize = quiz.questionBank.length;
  const drawCount = Math.min(quiz.questionsPerAttempt, poolSize);

  if (drawCount === 0) {
    throw new AuthorizationError("No approved questions available for this quiz");
  }

  const seed = hashSeed(studentId, quizId);
  const shuffledQuestions = seededShuffle(quiz.questionBank, seed);
  const selectedQuestions = shuffledQuestions.slice(0, drawCount);

  // Build question snapshot
  const questionSnapshot: Array<{
    questionBankItemId: string;
    type: string;
    content: Record<string, unknown>;
    shuffledOptionOrder?: number[];
  }> = [];

  for (const q of selectedQuestions) {
    const content = q.content as QuestionContent;

    let snapshotContent: Record<string, unknown> = { ...content };

    if (q.type === "MCQ") {
      // Shuffle MCQ options and track original indices
      const mcqContent = content as MCQContent;
      const optionIndices = mcqContent.options.map((_, i) => i);
      const shuffledIndices = seededShuffle(optionIndices, `${seed}:${q.id}`);
      
      snapshotContent = {
        ...mcqContent,
        options: shuffledIndices.map((i) => mcqContent.options[i]),
      };

      questionSnapshot.push({
        questionBankItemId: q.id,
        type: q.type,
        content: snapshotContent,
        shuffledOptionOrder: shuffledIndices,
      });
    } else if (q.type === "CALCULATION") {
      const strategy = getStrategy("CALCULATION");
      const { substitutedContent, correctValue } = strategy.rollForStudent!(
        content as import("../question-types/types").CalculationContent,
        `${seed}:${q.id}`
      );

      snapshotContent = {
        ...substitutedContent,
        _rolledCorrectValue: correctValue, // Store for grading
      };

      questionSnapshot.push({
        questionBankItemId: q.id,
        type: q.type,
        content: snapshotContent,
      });
    } else {
      questionSnapshot.push({
        questionBankItemId: q.id,
        type: q.type,
        content: snapshotContent,
      });
    }
  }

  const attempt = await prisma.studentAttempt.create({
    data: {
      studentId,
      quizId,
      questionSnapshot: questionSnapshot as object,
      status: AttemptStatus.IN_PROGRESS,
    },
    include: {
      quiz: {
        select: {
          id: true,
          timeLimitMinutes: true,
          deadline: true,
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
  });

  return attempt;
}

export async function getAttempt(
  attemptId: string,
  studentId: string
) {
  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        select: {
          id: true,
          timeLimitMinutes: true,
          deadline: true,
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
      answers: {
        include: {
          questionBankItem: {
            select: { id: true, type: true, content: true },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt");
  }

  if (attempt.studentId !== studentId) {
    throw new AuthorizationError("This is not your attempt");
  }

  return attempt;
}

export async function saveAnswer(
  attemptId: string,
  studentId: string,
  answers: Array<{
    questionBankItemId: string;
    answer: StudentAnswerValue;
  }>
) {
  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt");
  }

  if (attempt.studentId !== studentId) {
    throw new AuthorizationError("This is not your attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new AuthorizationError("Attempt already submitted");
  }

  // Upsert answers
  for (const { questionBankItemId, answer } of answers) {
    await prisma.studentAnswer.upsert({
      where: {
        attemptId_questionBankItemId: {
          attemptId,
          questionBankItemId,
        },
      },
      update: { answer: answer as object },
      create: {
        attemptId,
        questionBankItemId,
        answer: answer as object,
      },
    });
  }

  return prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          questionBankItem: {
            select: { id: true, type: true },
          },
        },
      },
    },
  });
}

export async function submitAttempt(
  attemptId: string,
  studentId: string,
  answers: Array<{
    questionBankItemId: string;
    answer: StudentAnswerValue;
  }>
) {
  const attempt = await prisma.studentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        select: {
          id: true,
          timeLimitMinutes: true,
        },
      },
      answers: {
        include: {
          questionBankItem: {
            select: { id: true, type: true, content: true },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt");
  }

  if (attempt.studentId !== studentId) {
    throw new AuthorizationError("This is not your attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new AuthorizationError("Attempt already submitted");
  }

  // Transition attempt status
  transitionAttempt(attempt.status, AttemptStatus.SUBMITTED);

  // Build map of questionBankItemId -> question data
  const questionMap = new Map<string, { type: string; content: QuestionContent }>();
  const snapshot = attempt.questionSnapshot as Array<{
    questionBankItemId: string;
    type: string;
    content: Record<string, unknown>;
  }>;
  for (const item of snapshot) {
    questionMap.set(item.questionBankItemId, {
      type: item.type,
      content: item.content as QuestionContent,
    });
  }

  let totalScore = 0;
  const gradedAnswers: Array<{
    questionBankItemId: string;
    answer: StudentAnswerValue;
    correctAnswer: CorrectAnswerSnapshot;
    isCorrect: boolean;
    pointsAwarded: number;
  }> = [];

  // Process each answer
  for (const { questionBankItemId, answer } of answers) {
    const questionData = questionMap.get(questionBankItemId);
    if (!questionData) continue;

    let correctAnswer: CorrectAnswerSnapshot = null;
    let isCorrect = false;
    let pointsAwarded = 0;

    if (questionData.type === "MCQ") {
      const mcqContent = questionData.content as MCQContent;
      correctAnswer = { correctIndex: mcqContent.correctOptionIndex };
      const result = getStrategy("MCQ").grade(answer, correctAnswer);
      isCorrect = result.isCorrect;
      pointsAwarded = result.pointsAwarded;
    } else if (questionData.type === "SHORT_ANSWER") {
      const saContent = questionData.content as ShortAnswerContent;
      correctAnswer = { correctAnswer: saContent.correctAnswer };
      const result = getStrategy("SHORT_ANSWER").grade(answer, correctAnswer);
      isCorrect = result.isCorrect;
      pointsAwarded = result.pointsAwarded;
    } else if (questionData.type === "CALCULATION") {
      const calcContent = questionData.content as CalculationContent & { _rolledCorrectValue?: number };
      correctAnswer = { correctValue: calcContent._rolledCorrectValue ?? 0 };
      const result = getStrategy("CALCULATION").grade(answer, correctAnswer);
      isCorrect = result.isCorrect;
      pointsAwarded = result.pointsAwarded;
    }

    totalScore += pointsAwarded;

    gradedAnswers.push({
      questionBankItemId,
      answer,
      correctAnswer,
      isCorrect,
      pointsAwarded,
    });
  }

  // Normalize score to percentage
  const maxScore = answers.length;
  const normalizedScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  // Update attempt with score
  const updatedAttempt = await prisma.studentAttempt.update({
    where: { id: attemptId },
    data: {
      status: AttemptStatus.SUBMITTED,
      score: normalizedScore,
      submittedAt: new Date(),
    },
    include: {
      answers: {
        include: {
          questionBankItem: {
            select: { id: true, type: true, content: true },
          },
        },
      },
    },
  });

  // Upsert graded answers
  for (const graded of gradedAnswers) {
    await prisma.studentAnswer.upsert({
      where: {
        attemptId_questionBankItemId: {
          attemptId,
          questionBankItemId: graded.questionBankItemId,
        },
      },
      update: {
        answer: graded.answer as object,
        correctAnswerSnapshot: graded.correctAnswer as object,
        isCorrect: graded.isCorrect,
        pointsAwarded: graded.pointsAwarded,
      },
      create: {
        attemptId,
        questionBankItemId: graded.questionBankItemId,
        answer: graded.answer as object,
        correctAnswerSnapshot: graded.correctAnswer as object,
        isCorrect: graded.isCorrect,
        pointsAwarded: graded.pointsAwarded,
      },
    });
  }

  return updatedAttempt;
}
