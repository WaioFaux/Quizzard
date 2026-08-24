import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { getMaterial, deleteMaterial } from "@/lib/services/material.service";
import { logger } from "@/lib/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params;
    const session = await requireTeacher();

    const material = await getMaterial(materialId, session.userId);

    return Response.json({ data: material });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params;
    const session = await requireTeacher();

    await deleteMaterial(materialId, session.userId);

    logger.info("material.delete", {
      userId: session.userId,
      materialId,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
