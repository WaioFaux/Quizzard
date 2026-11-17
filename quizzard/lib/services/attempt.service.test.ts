import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotFoundError,
  AuthorizationError,
  DeadlinePassedError,
  AttemptInProgressError,
  QuizNotPublishedError,
} from "../utils/errors";
import { QuizStatus, AttemptStatus } from "@prisma/client";

vi.mock("../db", () => ({
  prisma: {
    quiz: {
      findUnique: vi.fn(),
    },
    studentAttempt: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentAnswer: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "../db";

describe("Attempt Service (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startAttempt", () => {
    const baseQuiz = {
      id: "quiz-1",
      lectureId: "lecture-1",
      instructions: "",
      questionsPerAttempt: 3,
      timeLimitMinutes: 30,
      deadline: null as Date | null,
      status: QuizStatus.PUBLISHED,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lecture: {
        class: {
          enrollments: [{ studentId: "student-1" }],
        },
      },
      questionBank: [],
    };

    it("should throw NotFoundError when quiz does not exist", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null);

      const { startAttempt } = await import("../services/attempt.service");

      await expect(startAttempt("student-1", "quiz-1")).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when student is not enrolled", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        ...baseQuiz,
        lecture: {
          class: {
            enrollments: [{ studentId: "other-student" }],
          },
        },
      });

      const { startAttempt } = await import("../services/attempt.service");

      await expect(startAttempt("student-1", "quiz-1")).rejects.toThrow(AuthorizationError);
    });

    it("should throw QuizNotPublishedError when quiz is not published", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        ...baseQuiz,
        status: QuizStatus.DRAFT,
        lecture: {
          class: {
            enrollments: [{ studentId: "student-1" }],
          },
        },
      });

      const { startAttempt } = await import("../services/attempt.service");

      await expect(startAttempt("student-1", "quiz-1")).rejects.toThrow(QuizNotPublishedError);
    });

    it("should throw AttemptInProgressError when student already has an in-progress attempt", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        ...baseQuiz,
        lecture: {
          class: {
            enrollments: [{ studentId: "student-1" }],
          },
        },
      });

      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue({
        id: "attempt-1",
        quizId: "quiz-1",
        studentId: "student-1",
        questionSnapshot: [],
        status: AttemptStatus.IN_PROGRESS,
        score: null,
        startedAt: new Date(),
        submittedAt: null,
        quiz: {} as never,
        answers: [],
      });

      const { startAttempt } = await import("../services/attempt.service");

      await expect(startAttempt("student-1", "quiz-1")).rejects.toThrow(AttemptInProgressError);
    });

    it("should throw AuthorizationError when student already completed the quiz", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        ...baseQuiz,
        lecture: {
          class: {
            enrollments: [{ studentId: "student-1" }],
          },
        },
      });

      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue({
        id: "attempt-1",
        quizId: "quiz-1",
        studentId: "student-1",
        questionSnapshot: [],
        status: AttemptStatus.SUBMITTED,
        score: 85,
        startedAt: new Date(),
        submittedAt: new Date(),
        quiz: {} as never,
        answers: [],
      });

      const { startAttempt } = await import("../services/attempt.service");

      await expect(startAttempt("student-1", "quiz-1")).rejects.toThrow(
        "đã hoàn thành bài kiểm tra này"
      );
    });

    it("should start an attempt successfully with approved questions", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        ...baseQuiz,
        lecture: {
          class: {
            enrollments: [{ studentId: "student-1" }],
          },
        },
        questionBank: [
          {
            id: "q-1",
            type: "MCQ",
            content: { type: "MCQ", prompt: "Q1", options: ["A", "B"], correctOptionIndex: 0 },
            status: "APPROVED",
            quizId: "quiz-1",
            source: "AI_GENERATED",
            reviewNote: null,
            generationInstruction: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "q-2",
            type: "SHORT_ANSWER",
            content: { type: "SHORT_ANSWER", prompt: "Q2", correctAnswer: "Paris" },
            status: "APPROVED",
            quizId: "quiz-1",
            source: "AI_GENERATED",
            reviewNote: null,
            generationInstruction: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue(null);

      vi.mocked(prisma.studentAttempt.create).mockResolvedValue({
        id: "attempt-new",
        quizId: "quiz-1",
        studentId: "student-1",
        questionSnapshot: [],
        status: AttemptStatus.IN_PROGRESS,
        score: null,
        startedAt: new Date(),
        submittedAt: null,
        quiz: {
          id: "quiz-1",
          timeLimitMinutes: 30,
          deadline: null,
          lecture: {
            title: "Lecture",
            class: { name: "Class" },
          },
        },
      } as never);

      const { startAttempt } = await import("../services/attempt.service");

      const result = await startAttempt("student-1", "quiz-1");

      expect(result.id).toBe("attempt-new");
      expect(prisma.studentAttempt.create).toHaveBeenCalled();
    });

    it("should throw AuthorizationError when no approved questions available", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        ...baseQuiz,
        lecture: {
          class: {
            enrollments: [{ studentId: "student-1" }],
          },
        },
        questionBank: [], // No questions
      });

      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue(null);

      const { startAttempt } = await import("../services/attempt.service");

      await expect(startAttempt("student-1", "quiz-1")).rejects.toThrow(
        "chưa có câu hỏi nào được duyệt"
      );
    });
  });

  describe("submitAttempt", () => {
    it("should throw NotFoundError when attempt does not exist", async () => {
      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue(null);

      const { submitAttempt } = await import("../services/attempt.service");

      await expect(
        submitAttempt("attempt-1", "student-1", [])
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when student does not own the attempt", async () => {
      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue({
        id: "attempt-1",
        quizId: "quiz-1",
        studentId: "other-student",
        questionSnapshot: [],
        status: AttemptStatus.IN_PROGRESS,
        score: null,
        startedAt: new Date(),
        submittedAt: null,
        quiz: { id: "quiz-1", timeLimitMinutes: 30 },
        answers: [],
      } as never);

      const { submitAttempt } = await import("../services/attempt.service");

      await expect(
        submitAttempt("attempt-1", "student-1", [])
      ).rejects.toThrow(AuthorizationError);
    });

    it("should throw AuthorizationError when attempt already submitted", async () => {
      vi.mocked(prisma.studentAttempt.findUnique).mockResolvedValue({
        id: "attempt-1",
        quizId: "quiz-1",
        studentId: "student-1",
        questionSnapshot: [],
        status: AttemptStatus.SUBMITTED,
        score: 80,
        startedAt: new Date(),
        submittedAt: new Date(),
        quiz: { id: "quiz-1", timeLimitMinutes: 30 },
        answers: [],
      } as never);

      const { submitAttempt } = await import("../services/attempt.service");

      await expect(
        submitAttempt("attempt-1", "student-1", [])
      ).rejects.toThrow("Lượt làm bài đã được nộp");
    });
  });
});
