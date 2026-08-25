import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";

export async function createLecture(
  classId: string,
  teacherId: string,
  input: {
    title: string;
    sourceRef?: import("@/lib/validation/schemas").SourceRef | null;
    materialId?: string | null;
  }
) {
  // Verify class ownership
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    throw new NotFoundError("Class");
  }
  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  // Get next order number
  const lastLecture = await prisma.lecture.findFirst({
    where: { classId },
    orderBy: { order: "desc" },
  });
  const order = (lastLecture?.order ?? 0) + 1;

  const lecture = await prisma.lecture.create({
    data: {
      classId,
      title: input.title,
      sourceRef: input.sourceRef ?? null,
      materialId: input.materialId ?? null,
      order,
    },
    include: {
      class: {
        select: { id: true, name: true },
      },
      material: {
        select: { id: true, fileName: true },
      },
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
  });

  return lecture;
}

export async function getLecture(lectureId: string, teacherId: string) {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      class: {
        select: { id: true, teacherId: true },
      },
      material: {
        select: { id: true, fileName: true, status: true },
      },
      quiz: {
        select: {
          id: true,
          status: true,
          deadline: true,
          questionsPerAttempt: true,
          timeLimitMinutes: true,
          createdAt: true,
          _count: {
            select: { questionBank: true, attempts: true },
          },
        },
      },
    },
  });

  if (!lecture) {
    throw new NotFoundError("Lecture");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this lecture");
  }

  return lecture;
}

export async function listLectures(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    throw new NotFoundError("Class");
  }
  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  return prisma.lecture.findMany({
    where: { classId },
    include: {
      material: {
        select: { id: true, fileName: true },
      },
      quiz: {
        select: {
          id: true,
          status: true,
          deadline: true,
          questionsPerAttempt: true,
          timeLimitMinutes: true,
          _count: {
            select: { questionBank: true, attempts: true },
          },
        },
      },
    },
    orderBy: { order: "asc" },
  });
}

export async function updateLecture(
  lectureId: string,
  teacherId: string,
  input: {
    title?: string;
    sourceRef?: import("@/lib/validation/schemas").SourceRef | null;
    order?: number;
    materialId?: string | null;
  }
) {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      class: { select: { teacherId: true } },
    },
  });

  if (!lecture) {
    throw new NotFoundError("Lecture");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this lecture");
  }

  // If changing order, check for conflicts
  if (input.order !== undefined && input.order !== lecture.order) {
    const conflict = await prisma.lecture.findFirst({
      where: {
        classId: lecture.classId,
        order: input.order,
        id: { not: lectureId },
      },
    });
    if (conflict) {
      throw new AuthorizationError(
        `A lecture with order ${input.order} already exists in this class`
      );
    }
  }

  return prisma.lecture.update({
    where: { id: lectureId },
    data: {
      title: input.title ?? lecture.title,
      sourceRef: input.sourceRef !== undefined ? input.sourceRef : lecture.sourceRef,
      order: input.order ?? lecture.order,
      materialId: input.materialId !== undefined ? input.materialId : lecture.materialId,
    },
  });
}

export async function deleteLecture(lectureId: string, teacherId: string) {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      class: { select: { teacherId: true } },
    },
  });

  if (!lecture) {
    throw new NotFoundError("Lecture");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this lecture");
  }

  await prisma.lecture.delete({ where: { id: lectureId } });
}

export async function proposeLectures(
  classId: string,
  teacherId: string,
  materialId: string
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

  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) {
    throw new NotFoundError("Material");
  }

  const baseName = material.fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");

  const proposals = [
    { title: `${baseName} - Introduction`, startPage: 1, endPage: 5 },
    { title: `${baseName} - Core Concepts`, startPage: 6, endPage: 15 },
    { title: `${baseName} - Applications`, startPage: 16, endPage: 25 },
    { title: `${baseName} - Summary`, startPage: 26, endPage: 30 },
  ];

  return proposals;
}
