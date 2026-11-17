import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import { createMaterialFromBlob } from "@/lib/services/material.service";
import { logger } from "@/lib/utils/logger";

// Downloading and parsing a large PDF can take a while - give the function room.
export const maxDuration = 300;

interface CreateMaterialBody {
  classId?: string;
  fileName?: string;
  url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();

    const body = (await req.json().catch(() => ({}))) as CreateMaterialBody;
    const { classId, fileName, url } = body;

    if (!classId) {
      throw new ValidationError("classId is required");
    }
    if (!url) {
      throw new ValidationError("url is required");
    }
    if (!fileName) {
      throw new ValidationError("fileName is required");
    }
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      throw new ValidationError("Only PDF files are allowed");
    }

    const material = await createMaterialFromBlob(classId, session.userId, {
      filename: fileName,
      url,
    });

    logger.info("material.upload", {
      userId: session.userId,
      materialId: material.id,
      classId,
      fileName,
      status: material.status,
    });

    return Response.json({ data: material }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
