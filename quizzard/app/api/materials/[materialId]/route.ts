import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { prisma } from "@/lib/db";
import { NotFoundError, AuthorizationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params;
    const session = await requireTeacher();

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        class: { select: { teacherId: true } },
      },
    });

    if (!material) {
      throw new NotFoundError("Material");
    }

    if (material.class.teacherId !== session.userId) {
      throw new AuthorizationError("You do not own this material");
    }

    // Delete the file from storage if it exists
    if (material.filePath) {
      try {
        const { unlink } = await import("fs/promises");
        await unlink(material.filePath);
      } catch {
        // File might not exist, continue with deletion
      }
    }

    await prisma.material.delete({ where: { id: materialId } });

    logger.info("material.delete", {
      materialId,
      userId: session.userId,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
