import { handleUpload } from "@vercel/blob/client";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { prisma } from "@/lib/db";
import { MAX_MATERIAL_BYTES, MATERIAL_CONTENT_TYPES } from "@/lib/storage/blob";

/**
 * Issues the client token that lets the browser upload a PDF straight to the
 * blob store. Going through the browser is required because a serverless
 * request body is capped at 4.5 MB while materials may be up to 50 MB.
 */
export async function POST(request: Request) {
  try {
    const session = await requireTeacher();
    const body = await request.json();

    const clientPayload: string | null = body?.clientPayload ?? null;
    const classId = clientPayload ? safeParseClassId(clientPayload) : null;

    if (!classId) {
      throw new ValidationError("classId is required");
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    });

    if (!cls) {
      throw new NotFoundError("Class");
    }
    if (cls.teacherId !== session.userId) {
      throw new AuthorizationError("You do not own this class");
    }

    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (
          !pathname.startsWith("materials/") ||
          !pathname.toLowerCase().endsWith(".pdf")
        ) {
          throw new ValidationError("Invalid upload path");
        }

        return {
          allowedContentTypes: MATERIAL_CONTENT_TYPES,
          maximumSizeInBytes: MAX_MATERIAL_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(`[materials] uploaded ${blob.pathname}`);
      },
    });

    return jsonResponse;
  } catch (err) {
    return handleApiError(err);
  }
}

function safeParseClassId(clientPayload: string): string | null {
  try {
    const parsed = JSON.parse(clientPayload) as { classId?: string };
    return parsed.classId ?? null;
  } catch {
    return null;
  }
}
