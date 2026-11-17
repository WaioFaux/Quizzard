import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { proposeLectures } from "../ai/gemini-client";

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
    throw new NotFoundError("Lớp");
  }
  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu lớp này");
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
    throw new NotFoundError("Buổi giảng");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu buổi giảng này");
  }

  return lecture;
}

export async function listLectures(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    throw new NotFoundError("Lớp");
  }
  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu lớp này");
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
    throw new NotFoundError("Buổi giảng");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu buổi giảng này");
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
        `Một buổi giảng với thứ tự ${input.order} đã tồn tại trong lớp này`
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

export async function getLectureById(lectureId: string) {
  return prisma.lecture.findUnique({
    where: { id: lectureId },
  });
}

export async function deleteLecture(lectureId: string, teacherId: string) {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      class: { select: { teacherId: true } },
      quiz: true,
    },
  });

  if (!lecture) {
    throw new NotFoundError("Buổi giảng");
  }

  if (lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu buổi giảng này");
  }

  // Delete associated quiz (cascade will handle attempts, answers, reports)
  if (lecture.quiz) {
    await prisma.quiz.delete({
      where: { id: lecture.quiz.id },
    });
  }

  await prisma.lecture.delete({ where: { id: lectureId } });

  // Reorder remaining lectures to fill the gap
  const remainingLectures = await prisma.lecture.findMany({
    where: { classId: lecture.classId },
    orderBy: { order: "asc" },
  });

  // Update order for each lecture to be consecutive starting from 1
  for (let i = 0; i < remainingLectures.length; i++) {
    const newOrder = i + 1;
    if (remainingLectures[i].order !== newOrder) {
      await prisma.lecture.update({
        where: { id: remainingLectures[i].id },
        data: { order: newOrder },
      });
    }
  }
}

export async function proposeLecturesFromMaterial(
  classId: string,
  teacherId: string,
  materialId: string
) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!cls) {
    throw new NotFoundError("Lớp");
  }

  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu lớp này");
  }

  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) {
    throw new NotFoundError("Tài liệu");
  }

  // Check if material has been processed
  if (material.status !== "PROCESSED" || !material.extractedText) {
    throw new Error("Tài liệu vẫn đang được xử lý hoặc chưa có nội dung trích xuất");
  }

  // Call Gemini API to propose lectures
  const proposals = await proposeLectures(material.extractedText);

  return proposals;
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
    throw new NotFoundError("Lớp");
  }

  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không sở hữu lớp này");
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

    // Auto-create a draft quiz for the lecture
    const quiz = await prisma.quiz.create({
      data: {
        lectureId: lecture.id,
        instructions: `Generate questions covering: ${proposal.title}`,
        questionsPerAttempt: 5,
        timeLimitMinutes: 30,
      },
    });

    results.push({ lectureId: lecture.id, quizId: quiz.id });
  }

  return results;
}
