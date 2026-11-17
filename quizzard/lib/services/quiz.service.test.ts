import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { QuizStatus } from "@prisma/client";

vi.mock("../db", () => ({
  prisma: {
    lecture: {
      findUnique: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    questionBankItem: {
      count: vi.fn(),
    },
    studentAttempt: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../db";

describe("Quiz Service (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createQuiz", () => {
    it("should throw NotFoundError when lecture does not exist", async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

      const { createQuiz } = await import("../services/quiz.service");

      await expect(
        createQuiz("teacher-1", {
          lectureId: "lecture-1",
          instructions: "Test instructions",
          questionsPerAttempt: 5,
          timeLimitMinutes: 30,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when teacher does not own the class", async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        id: "lecture-1",
        class: { teacherId: "other-teacher" },
        quiz: null,
        title: "",
        sourceRef: null,
        order: 1,
        createdAt: new Date(),
        classId: "",
        materialId: null,
        material: null as never,
      });

      const { createQuiz } = await import("../services/quiz.service");

      await expect(
        createQuiz("teacher-1", {
          lectureId: "lecture-1",
          instructions: "Test instructions",
          questionsPerAttempt: 5,
          timeLimitMinutes: 30,
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it("should throw AuthorizationError when lecture already has a quiz", async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        id: "lecture-1",
        class: { teacherId: "teacher-1" },
        quiz: { id: "quiz-existing" },
        title: "",
        sourceRef: null,
        order: 1,
        createdAt: new Date(),
        classId: "",
        materialId: null,
        material: null as never,
      });

      const { createQuiz } = await import("../services/quiz.service");

      await expect(
        createQuiz("teacher-1", {
          lectureId: "lecture-1",
          instructions: "Test instructions",
          questionsPerAttempt: 5,
          timeLimitMinutes: 30,
        })
      ).rejects.toThrow("đã có bài kiểm tra");
    });

    it("should create a quiz successfully", async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        id: "lecture-1",
        class: { teacherId: "teacher-1" },
        quiz: null,
        title: "Test Lecture",
        sourceRef: null,
        order: 1,
        createdAt: new Date(),
        classId: "class-1",
        materialId: null,
        material: null as never,
      });

      vi.mocked(prisma.quiz.create).mockResolvedValue({
        id: "quiz-new",
        lectureId: "lecture-1",
        instructions: "Test instructions",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: null,
        status: QuizStatus.DRAFT,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Test Lecture",
          class: { id: "class-1", name: "Test Class" },
        },
        _count: { questionBank: 0 },
      });

      const { createQuiz } = await import("../services/quiz.service");

      const result = await createQuiz("teacher-1", {
        lectureId: "lecture-1",
        instructions: "Test instructions",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
      });

      expect(result.id).toBe("quiz-new");
      expect(result.status).toBe(QuizStatus.DRAFT);
      expect(prisma.quiz.create).toHaveBeenCalled();
    });
  });

  describe("getQuiz", () => {
    it("should throw NotFoundError when quiz does not exist", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null);

      const { getQuiz } = await import("../services/quiz.service");

      await expect(getQuiz("quiz-1", "teacher-1")).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when teacher does not own quiz", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: null,
        status: QuizStatus.DRAFT,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Lecture",
          class: { id: "class-1", teacherId: "other-teacher" },
        },
        _count: { questionBank: 0, attempts: 0 },
      });

      const { getQuiz } = await import("../services/quiz.service");

      await expect(getQuiz("quiz-1", "teacher-1")).rejects.toThrow(AuthorizationError);
    });

    it("should return quiz when teacher owns it", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "Test",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: null,
        status: QuizStatus.DRAFT,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Lecture",
          class: { id: "class-1", teacherId: "teacher-1" },
        },
        _count: { questionBank: 0, attempts: 0 },
      });

      const { getQuiz } = await import("../services/quiz.service");

      const result = await getQuiz("quiz-1", "teacher-1");
      expect(result.id).toBe("quiz-1");
    });
  });

  describe("publishQuiz", () => {
    it("should throw AuthorizationError if not all questions are approved", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: null,
        status: QuizStatus.DRAFT,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Lecture",
          class: { id: "class-1", teacherId: "teacher-1" },
        },
        _count: { questionBank: 3 }, // only 3 of 5 approved
      });

      vi.mocked(prisma.questionBankItem.count).mockResolvedValue(5); // total 5 questions

      const { publishQuiz } = await import("../services/quiz.service");

      await expect(publishQuiz("quiz-1", "teacher-1")).rejects.toThrow(
        "Tất cả câu hỏi phải được duyệt"
      );
    });

    it("should publish quiz when all questions are approved", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: null,
        status: QuizStatus.DRAFT,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Lecture",
          class: { id: "class-1", teacherId: "teacher-1" },
        },
        _count: { questionBank: 5 }, // all 5 approved
      });

      vi.mocked(prisma.questionBankItem.count).mockResolvedValue(5);

      vi.mocked(prisma.quiz.update).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: null,
        status: QuizStatus.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { publishQuiz } = await import("../services/quiz.service");

      const result = await publishQuiz("quiz-1", "teacher-1");
      expect(result.status).toBe(QuizStatus.PUBLISHED);
    });
  });

  describe("extendDeadline", () => {
    it("should throw AuthorizationError when shortening deadline", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: new Date("2026-10-01"),
        status: QuizStatus.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Lecture",
          class: { id: "class-1", teacherId: "teacher-1" },
        },
      });

      const { extendDeadline } = await import("../services/quiz.service");

      await expect(
        extendDeadline("quiz-1", "teacher-1", "2026-09-01T00:00:00Z")
      ).rejects.toThrow("Không thể rút ngắn hạn chót");
    });

    it("should allow extending deadline", async () => {
      vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: new Date("2026-10-01"),
        status: QuizStatus.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lecture: {
          id: "lecture-1",
          title: "Lecture",
          class: { id: "class-1", teacherId: "teacher-1" },
        },
      });

      vi.mocked(prisma.quiz.update).mockResolvedValue({
        id: "quiz-1",
        lectureId: "lecture-1",
        instructions: "",
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
        deadline: new Date("2026-10-15"),
        status: QuizStatus.PUBLISHED,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { extendDeadline } = await import("../services/quiz.service");

      const result = await extendDeadline("quiz-1", "teacher-1", "2026-10-15T00:00:00Z");
      expect(prisma.quiz.update).toHaveBeenCalled();
    });
  });
});
