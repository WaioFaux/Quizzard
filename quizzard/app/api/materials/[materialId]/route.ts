import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { deleteMaterial } from "@/lib/services/material.service";
import { logger } from "@/lib/utils/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params;
    const session = await requireTeacher();

    // Removes the blob from storage and the database row
    await deleteMaterial(materialId, session.userId);

    logger.info("material.delete", {
      materialId,
      userId: session.userId,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
