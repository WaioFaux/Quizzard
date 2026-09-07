import path from "path";
import fs from "fs/promises";
import { prisma } from "../db";
import { NotFoundError, AuthorizationError, ValidationError } from "../utils/errors";
import { extractTextFromPDF, truncateText } from "../pdf/extract";
import { logger } from "../utils/logger";

const UPLOAD_DIR = process.env.FILE_STORAGE_PATH ?? "./public/uploads";

// Max file size: 50 MB
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// PDF magic bytes (file signature)
const PDF_MAGIC_BYTES = Buffer.from("%PDF-", "ascii");

function validatePdfMagicBytes(buffer: Buffer): void {
  if (buffer.length < PDF_MAGIC_BYTES.length) {
    throw new ValidationError("File is too small to be a valid PDF");
  }
  const header = buffer.slice(0, PDF_MAGIC_BYTES.length);
  if (!header.equals(PDF_MAGIC_BYTES)) {
    throw new ValidationError("File does not have a valid PDF signature");
  }
}

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

  // Enforce file size limit
  if (file.data.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File exceeds maximum size of 50 MB");
  }

  // Validate magic bytes to ensure the file is actually a PDF
  validatePdfMagicBytes(file.data);

  // Validate extension is .pdf
  const ext = path.extname(file.filename).toLowerCase();
  if (ext !== ".pdf") {
    throw new ValidationError("Only PDF files are allowed");
  }

  // Ensure upload directory exists
  const uploadDir = path.resolve(UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const safeExt = ".pdf"; // Always use .pdf since we validated the content above
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`;
  const filePath = path.join(uploadDir, uniqueName);
  const publicPath = `/uploads/${uniqueName}`;

  // Write file
  await fs.writeFile(filePath, file.data);

  // Create material record with PROCESSING status
  const material = await prisma.material.create({
    data: {
      fileName: file.filename,
      filePath: publicPath,
      classId,
      status: "PROCESSING",
    },
  });

  // Extract just the filename for the processing function
  const filename = path.basename(publicPath);

  // Process PDF in background (don't await to avoid blocking the response)
  processMaterialAsync(material.id, filename).catch((error) => {
    console.error(`Failed to process material ${material.id}:`, error);
  });

  return material;
}

async function processMaterialAsync(materialId: string, filename: string) {
  const startTime = Date.now();

  try {
    // Resolve the full path before extraction
    const uploadDir = path.resolve(UPLOAD_DIR);
    const absolutePath = path.join(uploadDir, filename);

    logger.info("material.processing.start", {
      materialId,
      filename,
      absolutePath,
    });

    // Extract text from PDF
    const extraction = await extractTextFromPDF(absolutePath);
    const truncatedText = truncateText(extraction.text);

    // Validate extracted text is not empty
    if (!truncatedText || truncatedText.trim().length === 0) {
      throw new Error("PDF extracted text is empty - the file may be scanned/image-based or corrupted");
    }

    // Update material with extracted text
    await prisma.material.update({
      where: { id: materialId },
      data: {
        status: "PROCESSED",
        extractedText: truncatedText,
      },
    });

    logger.info("material.processing.success", {
      materialId,
      textLength: truncatedText.length,
      pageCount: extraction.pageCount,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("material.processing.failed", {
      materialId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: Date.now() - startTime,
    });

    // Mark as failed
    await prisma.material.update({
      where: { id: materialId },
      data: {
        status: "FAILED",
      },
    });
  }
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

export async function reprocessMaterial(materialId: string, teacherId: string) {
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

  // Reset status and reprocess
  await prisma.material.update({
    where: { id: materialId },
    data: { status: "PROCESSING", extractedText: null },
  });

  // Process in background
  processMaterialAsync(materialId, path.basename(material.filePath)).catch((error) => {
    console.error(`Failed to reprocess material ${materialId}:`, error);
  });

  return prisma.material.findUnique({ where: { id: materialId } });
}
