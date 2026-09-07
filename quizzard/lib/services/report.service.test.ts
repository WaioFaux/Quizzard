import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError, AuthorizationError } from "../utils/errors";

vi.mock("../db", () => ({
  prisma: {
    studentAnswer: {
      findUnique: vi.fn(),
    },
    questionReport: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../db";

describe("Report Service (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createReport", () => {
    it("should throw NotFoundError when answer does not exist", async () => {
      vi.mocked(prisma.studentAnswer.findUnique).mockResolvedValue(null);

      const { createReport } = await import("../services/report.service");

      await expect(
        createReport("student-1", {
          studentAnswerId: "answer-1",
          description: "This question seems incorrect.",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when answer belongs to another student", async () => {
      vi.mocked(prisma.studentAnswer.findUnique).mockResolvedValue({
        id: "answer-1",
        attemptId: "attempt-1",
        questionBankItemId: "q-1",
        answer: {},
        correctAnswerSnapshot: null,
        isCorrect: null,
        pointsAwarded: null,
        attempt: {
          studentId: "other-student",
          status: "SUBMITTED",
        },
        questionBankItem: {} as never,
        reports: [],
      } as never);

      const { createReport } = await import("../services/report.service");

      await expect(
        createReport("student-1", {
          studentAnswerId: "answer-1",
          description: "This question seems incorrect.",
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it("should throw AuthorizationError when attempting to report an in-progress attempt", async () => {
      vi.mocked(prisma.studentAnswer.findUnique).mockResolvedValue({
        id: "answer-1",
        attemptId: "attempt-1",
        questionBankItemId: "q-1",
        answer: {},
        correctAnswerSnapshot: null,
        isCorrect: null,
        pointsAwarded: null,
        attempt: {
          studentId: "student-1",
          status: "IN_PROGRESS",
        },
        questionBankItem: {} as never,
        reports: [],
      } as never);

      const { createReport } = await import("../services/report.service");

      await expect(
        createReport("student-1", {
          studentAnswerId: "answer-1",
          description: "This question seems incorrect.",
        })
      ).rejects.toThrow("unsubmitted attempt");
    });

    it("should create a report successfully", async () => {
      vi.mocked(prisma.studentAnswer.findUnique).mockResolvedValue({
        id: "answer-1",
        attemptId: "attempt-1",
        questionBankItemId: "q-1",
        answer: {},
        correctAnswerSnapshot: null,
        isCorrect: null,
        pointsAwarded: null,
        attempt: {
          studentId: "student-1",
          status: "SUBMITTED",
        },
        questionBankItem: { id: "q-1", type: "MCQ", content: {} },
        reports: [],
      } as never);

      vi.mocked(prisma.questionReport.create).mockResolvedValue({
        id: "report-new",
        studentAnswerId: "answer-1",
        description: "This question seems incorrect.",
        status: "PENDING",
        teacherNote: null,
        createdAt: new Date(),
        studentAnswer: {} as never,
      } as never);

      const { createReport } = await import("../services/report.service");

      const result = await createReport("student-1", {
        studentAnswerId: "answer-1",
        description: "This question seems incorrect.",
      });

      expect(result.id).toBe("report-new");
      expect(result.status).toBe("PENDING");
    });
  });

  describe("listReports", () => {
    it("should return reports for quizzes owned by the teacher", async () => {
      vi.mocked(prisma.questionReport.findMany).mockResolvedValue([
        {
          id: "report-1",
          studentAnswerId: "answer-1",
          description: "Bad question",
          status: "PENDING",
          teacherNote: null,
          createdAt: new Date(),
          studentAnswer: {
            questionBankItem: { id: "q-1", type: "MCQ", content: {} },
            attempt: {
              id: "attempt-1",
              score: 80,
              student: { id: "student-1", name: "John Doe" },
              quiz: {
                id: "quiz-1",
                lecture: {
                  title: "Lecture 1",
                  class: { name: "Class A" },
                },
              },
            },
          },
        },
      ] as never);

      const { listReports } = await import("../services/report.service");

      const result = await listReports("teacher-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("report-1");
    });
  });

  describe("updateReport", () => {
    it("should throw NotFoundError when report does not exist", async () => {
      vi.mocked(prisma.questionReport.findUnique).mockResolvedValue(null);

      const { updateReport } = await import("../services/report.service");

      await expect(
        updateReport("report-1", "teacher-1", { status: "RESOLVED" })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when teacher does not own the report", async () => {
      vi.mocked(prisma.questionReport.findUnique).mockResolvedValue({
        id: "report-1",
        studentAnswerId: "answer-1",
        description: "Bad question",
        status: "PENDING",
        teacherNote: null,
        createdAt: new Date(),
        studentAnswer: {
          attempt: {
            quiz: {
              lecture: {
                class: { teacherId: "other-teacher" },
              },
            },
          },
        },
      } as never);

      const { updateReport } = await import("../services/report.service");

      await expect(
        updateReport("report-1", "teacher-1", { status: "RESOLVED" })
      ).rejects.toThrow(AuthorizationError);
    });

    it("should update report status successfully", async () => {
      vi.mocked(prisma.questionReport.findUnique).mockResolvedValue({
        id: "report-1",
        studentAnswerId: "answer-1",
        description: "Bad question",
        status: "PENDING",
        teacherNote: null,
        createdAt: new Date(),
        studentAnswer: {
          attempt: {
            quiz: {
              lecture: {
                class: { teacherId: "teacher-1" },
              },
            },
          },
        },
      } as never);

      vi.mocked(prisma.questionReport.update).mockResolvedValue({
        id: "report-1",
        studentAnswerId: "answer-1",
        description: "Bad question",
        status: "RESOLVED",
        teacherNote: "Reviewed and fixed for next term.",
        createdAt: new Date(),
        studentAnswer: {} as never,
      } as never);

      const { updateReport } = await import("../services/report.service");

      const result = await updateReport("report-1", "teacher-1", {
        status: "RESOLVED",
        reviewNote: "Reviewed and fixed for next term.",
      });

      expect(result.status).toBe("RESOLVED");
      expect(result.teacherNote).toBe("Reviewed and fixed for next term.");
    });
  });
});
