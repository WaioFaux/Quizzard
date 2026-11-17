import { prisma } from "../db";
import { NotFoundError, AuthorizationError, ValidationError } from "../utils/errors";
import { extractTextFromPDFBuffer, truncateText } from "../pdf/extract";
import { logger } from "../utils/logger";
import {
  MAX_MATERIAL_BYTES,
  deleteBlob,
  downloadBlob,
  getBlobInfo,
} from "../storage/blob";

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

/**
 * Creates a material record for a PDF that was uploaded straight to the blob
 * store by the browser, then extracts its text.
 *
 * The extraction runs inline (not in the background) because a serverless
 * function is frozen as soon as the response is sent.
 */
export async function createMaterialFromBlob(
  classId: string,
  teacherId: string,
  file: { filename: string; url: string }
) {
  // Verify class ownership
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) {
    throw new NotFoundError("Class");
  }
  if (cls.teacherId !== teacherId) {
    throw new AuthorizationError("You do not own this class");
  }

  if (!file.url || !file.url.startsWith("https://")) {
    throw new ValidationError("A valid upload URL is required");
  }

  // Enforce file size limit using the blob metadata (no download yet)
  const info = await getBlobInfo(file.url);
  if (info.size > MAX_MATERIAL_BYTES) {
    await deleteBlob(info.url);
    throw new ValidationError("File exceeds maximum size of 50 MB");
  }

  const buffer = await downloadBlob(info.url);

  // Validate magic bytes to ensure the file is actually a PDF
  try {
    validatePdfMagicBytes(buffer);
  } catch (error) {
    await deleteBlob(info.url);
    throw error;
  }

  // Create material record with PROCESSING status
  const material = await prisma.material.create({
    data: {
      fileName: file.filename,
      filePath: info.url,
      classId,
      status: "PROCESSING",
    },
  });

  // Process the PDF inline so the status is final by the time we respond
  const processed = await processMaterial(material.id, info.url);

  return processed ?? material;
}

/**
 * Extracts the text of a stored PDF and updates the material status.
 * Returns the updated material, or null when the material disappeared.
 */
export async function processMaterial(materialId: string, url: string) {
  const startTime = Date.now();

  try {
    const buffer = await downloadBlob(url);
    const extraction = await extractTextFromPDFBuffer(buffer);
    const truncatedText = truncateText(extraction.text);

    if (!truncatedText || truncatedText.trim().length === 0) {
      throw new Error(
        "PDF extracted text is empty - the file may be scanned/image-based or corrupted"
      );
    }

    const material = await prisma.material.update({
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

    return material;
  } catch (error) {
    logger.error("material.processing.failed", {
      materialId,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startTime,
    });

    // Mark as failed
    return prisma.material.update({
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

  // Delete the file from the blob store
  await deleteBlob(material.filePath);

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

  // Process inline
  const updated = await processMaterial(materialId, material.filePath);

  return updated ?? prisma.material.findUnique({ where: { id: materialId } });
}
