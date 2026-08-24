import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError, NotFoundError, AuthorizationError } from "../utils/errors";

// Mock prisma before importing the service
vi.mock("../db", () => ({
  prisma: {
    class: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../db";

describe("Class Service (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("joinClass", () => {
    it("should throw NotFoundError when class code does not exist", async () => {
      vi.mocked(prisma.class.findUnique).mockResolvedValue(null);

      const { joinClass } = await import("../services/class.service");

      await expect(
        joinClass("student-1", "INVALID", "password")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when password is wrong", async () => {
      vi.mocked(prisma.class.findUnique).mockResolvedValue({
        id: "class-1",
        name: "Test Class",
        classCode: "ABC123",
        classPassword: "correct-password",
        teacherId: "teacher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        teacher: {} as never,
        materials: [],
        lectures: [],
        enrollments: [],
      });

      const { joinClass } = await import("../services/class.service");

      await expect(
        joinClass("student-1", "ABC123", "wrong-password")
      ).rejects.toThrow(AuthorizationError);
    });

    it("should throw ConflictError when already enrolled", async () => {
      vi.mocked(prisma.class.findUnique).mockResolvedValue({
        id: "class-1",
        name: "Test Class",
        classCode: "ABC123",
        classPassword: "correct-password",
        teacherId: "teacher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        teacher: {} as never,
        materials: [],
        lectures: [],
        enrollments: [],
      });

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: "enrollment-1",
        classId: "class-1",
        studentId: "student-1",
        joinedAt: new Date(),
        class: {} as never,
        student: {} as never,
      });

      const { joinClass } = await import("../services/class.service");

      await expect(
        joinClass("student-1", "ABC123", "correct-password")
      ).rejects.toThrow(ConflictError);
    });

    it("should create enrollment on successful join", async () => {
      const mockClass = {
        id: "class-1",
        name: "Test Class",
        classCode: "ABC123",
        classPassword: "correct-password",
        teacherId: "teacher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        teacher: {} as never,
        materials: [],
        lectures: [],
        enrollments: [],
      };

      const mockEnrollment = {
        id: "enrollment-1",
        classId: "class-1",
        studentId: "student-1",
        joinedAt: new Date(),
        class: { id: "class-1", name: "Test Class", description: null, classCode: "ABC123" },
        student: {} as never,
      };

      vi.mocked(prisma.class.findUnique).mockResolvedValue(mockClass);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.enrollment.create).mockResolvedValue(mockEnrollment);

      const { joinClass } = await import("../services/class.service");

      const result = await joinClass("student-1", "ABC123", "correct-password");

      expect(result).toEqual(mockEnrollment);
      expect(prisma.enrollment.create).toHaveBeenCalledWith({
        data: {
          classId: "class-1",
          studentId: "student-1",
        },
        include: expect.any(Object),
      });
    });
  });

  describe("getClassById", () => {
    it("should throw NotFoundError when class does not exist", async () => {
      vi.mocked(prisma.class.findUnique).mockResolvedValue(null);

      const { getClassById } = await import("../services/class.service");

      await expect(
        getClassById("invalid-id", "user-1", "TEACHER")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError when teacher does not own class", async () => {
      vi.mocked(prisma.class.findUnique).mockResolvedValue({
        id: "class-1",
        name: "Test Class",
        classCode: "ABC123",
        classPassword: "pass",
        teacherId: "teacher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        teacher: { id: "teacher-1", name: "Teacher", email: "t@t.com" },
        materials: [],
        lectures: [],
        enrollments: [],
      });

      const { getClassById } = await import("../services/class.service");

      await expect(
        getClassById("class-1", "different-teacher", "TEACHER")
      ).rejects.toThrow(AuthorizationError);
    });

    it("should throw AuthorizationError when student is not enrolled", async () => {
      vi.mocked(prisma.class.findUnique).mockResolvedValue({
        id: "class-1",
        name: "Test Class",
        classCode: "ABC123",
        classPassword: "pass",
        teacherId: "teacher-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        teacher: { id: "teacher-1", name: "Teacher", email: "t@t.com" },
        materials: [],
        lectures: [],
        enrollments: [{ id: "e1", student: { id: "other-student", name: "Other", email: "o@o.com" }, joinedAt: new Date(), class: {} as never, student: {} as never }],
      });

      const { getClassById } = await import("../services/class.service");

      await expect(
        getClassById("class-1", "unenrolled-student", "STUDENT")
      ).rejects.toThrow(AuthorizationError);
    });
  });
});

describe("Class Code Generation", () => {
  it("should generate 6-character alphanumeric codes", async () => {
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null); // No duplicate
    vi.mocked(prisma.class.create).mockImplementation(async (data: any) => ({
      id: "new-class-id",
      ...data.data,
      createdAt: new Date(),
      updatedAt: new Date(),
      teacher: {} as never,
      materials: [],
      lectures: [],
      enrollments: [],
    }));

    const { createClass } = await import("../services/class.service");

    const cls = await createClass("teacher-1", {
      name: "Test Class",
      classPassword: "password",
    });

    expect(cls.classCode).toHaveLength(6);
    expect(cls.classCode).toMatch(/^[A-Z0-9]+$/);
  });
});
