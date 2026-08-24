import path from "path";
import fs from "fs/promises";
import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";

const UPLOAD_DIR = process.env.FILE_STORAGE_PATH ?? "./public/uploads";

export async function uploadMaterial(
  classId: string,
  teacherId: string,
  file: { filename: string; data: Buffer }
) {
  // Verify class ownership
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    throw new NotFoundError("Class");
  }
  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  // Ensure upload directory exists
  const uploadDir = path.resolve(UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const ext = path.extname(file.filename);
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadDir, uniqueName);
  const publicPath = `/uploads/${uniqueName}`;

  // Write file
  await fs.writeFile(filePath, file.data);

  const material = await prisma.material.create({
    data: {
      fileName: file.filename,
      filePath: publicPath,
      classId,
      status: "PROCESSING",
    },
  });

  return material;
}

export async function getMaterial(materialId: string, teacherId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      class: {
        select: { id: true, teacherId: true },
      },
      lectures: {
        select: { id: true, title: true, order: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!material) {
    throw new NotFoundError("Material");
  }

  if (material.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this material");
  }

  return material;
}

export async function deleteMaterial(materialId: string, teacherId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      class: {
        select: { teacherId: true },
      },
    },
  });

  if (!material) {
    throw new NotFoundError("Material");
  }

  if (material.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this material");
  }

  // Delete file from disk
  const filePath = path.resolve(
    process.env.FILE_STORAGE_PATH ?? "./public/uploads",
    path.basename(material.filePath)
  );
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist, continue
  }

  await prisma.material.delete({ where: { id: materialId } });
}

export async function updateMaterialStatus(
  materialId: string,
  status: "PROCESSING" | "PROCESSED" | "FAILED",
  extractedText?: string
) {
  return prisma.material.update({
    where: { id: materialId },
    data: {
      status,
      ...(extractedText !== undefined && { extractedText }),
    },
  });
}
