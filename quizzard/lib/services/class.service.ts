import { prisma } from "../db";
import { ConflictError, NotFoundError, AuthorizationError } from "../utils/errors";
import { CreateClassInput, UpdateClassInput } from "../validation/schemas";
import { Role } from "@prisma/client";

function generateClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createClass(
  teacherId: string,
  input: CreateClassInput
) {
  // Generate unique class code
  let classCode = generateClassCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.class.findUnique({ where: { classCode } });
    if (!existing) break;
    classCode = generateClassCode();
    attempts++;
  }

  const cls = await prisma.class.create({
    data: {
      name: input.name,
      description: input.description,
      classCode,
      classPassword: input.classPassword,
      teacherId,
    },
    include: {
      teacher: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { enrollments: true, lectures: true },
      },
    },
  });

  return cls;
}

export async function getClassById(classId: string, userId: string, userRole: Role) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: {
        select: { id: true, name: true, email: true },
      },
      enrollments: {
        select: {
          id: true,
          joinedAt: true,
          student: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      lectures: {
        select: {
          id: true,
          title: true,
          order: true,
          quiz: {
            select: {
              id: true,
              status: true,
              deadline: true,
              questionsPerAttempt: true,
              timeLimitMinutes: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
      materials: {
        select: {
          id: true,
          fileName: true,
          status: true,
          uploadedAt: true,
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!cls) {
    throw new NotFoundError("Class");
  }

  // Authorization: teacher must own the class, student must be enrolled
  if (userRole === Role.TEACHER && cls.teacherId !== userId) {
    throw new AuthorizationError("You do not own this class");
  }

  if (userRole === Role.STUDENT) {
    const isEnrolled = cls.enrollments.some((e) => e.student.id === userId);
    if (!isEnrolled) {
      throw new AuthorizationError("You are not enrolled in this class");
    }
  }

  return cls;
}

export async function listTeacherClasses(teacherId: string) {
  return prisma.class.findMany({
    where: { teacherId },
    include: {
      _count: {
        select: { enrollments: true, lectures: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listStudentEnrollments(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      class: {
        include: {
          teacher: {
            select: { id: true, name: true },
          },
          lectures: {
            select: {
              id: true,
              title: true,
              order: true,
              quiz: {
                select: {
                  id: true,
                  status: true,
                  deadline: true,
                  timeLimitMinutes: true,
                },
              },
            },
            orderBy: { order: "asc" },
          },
          _count: {
            select: { enrollments: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return enrollments.map((e) => e.class);
}

export async function updateClass(
  classId: string,
  teacherId: string,
  input: UpdateClassInput
) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });

  if (!cls) {
    throw new NotFoundError("Class");
  }

  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  return prisma.class.update({
    where: { id: classId },
    data: {
      name: input.name ?? cls.name,
      description: input.description !== undefined ? input.description : cls.description,
      classPassword: input.classPassword ?? cls.classPassword,
    },
  });
}

export async function deleteClass(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });

  if (!cls) {
    throw new NotFoundError("Class");
  }

  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  await prisma.class.delete({ where: { id: classId } });
}

export async function joinClass(studentId: string, classCode: string, classPassword: string) {
  const cls = await prisma.class.findUnique({
    where: { classCode },
  });

  if (!cls) {
    throw new NotFoundError("Class");
  }

  if (cls.classPassword !== classPassword) {
    throw new AuthorizationError("Invalid class password");
  }

  // Check if already enrolled
  const existing = await prisma.enrollment.findUnique({
    where: {
      classId_studentId: {
        classId: cls.id,
        studentId,
      },
    },
  });

  if (existing) {
    throw new ConflictError("Already enrolled in this class");
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      classId: cls.id,
      studentId,
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          description: true,
          classCode: true,
        },
      },
    },
  });

  return enrollment;
}

export async function listClassStudents(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });

  if (!cls) {
    throw new NotFoundError("Class");
  }

  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  return prisma.enrollment.findMany({
    where: { classId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
}
