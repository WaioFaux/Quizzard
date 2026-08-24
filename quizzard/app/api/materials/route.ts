import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import { uploadMaterial } from "@/lib/services/material.service";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const formData = await req.formData();

    const classId = formData.get("classId") as string | null;
    const file = formData.get("file") as File | null;

    if (!classId) {
      throw new ValidationError("classId is required");
    }

    if (!file) {
      throw new ValidationError("file is required");
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      throw new ValidationError("Only PDF files are allowed");
    }

    // Limit file size to 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new ValidationError("File size must be less than 50MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const material = await uploadMaterial(classId, session.userId, {
      filename: file.name,
      data: buffer,
    });

    logger.info("material.upload", {
      userId: session.userId,
      materialId: material.id,
      classId,
      fileName: file.name,
    });

    return Response.json({ data: material }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
