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
 *
 * The blob client posts an event of the shape
 *   { type, payload: { pathname, clientPayload, multipart } }
 * so the class id travels inside `payload.clientPayload`.
 *
 * The same endpoint receives the "blob.upload-completed" callback, which is
 * signed by Vercel rather than by the session cookie - so the session check
 * only applies to the token request.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // The completion callback is machine-to-machine and carries a signature
    // header instead of the session cookie.
    if (body?.type === "blob.upload-completed") {
      const jsonResponse = await handleUpload({
        request,
        body,
        onUploadCompleted: async ({ blob }) => {
          console.log(`[materials] uploaded ${blob.pathname}`);
        },
      });
      return Response.json(jsonResponse);
    }

    const session = await requireTeacher();

    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (
          !pathname.startsWith("materials/") ||
          !pathname.toLowerCase().endsWith(".pdf")
        ) {
          throw new ValidationError("Invalid upload path");
        }

        const classId = safeParseClassId(clientPayload);
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

        return {
          allowedContentTypes: MATERIAL_CONTENT_TYPES,
          maximumSizeInBytes: MAX_MATERIAL_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });

    return Response.json(jsonResponse);
  } catch (err) {
    return handleApiError(err);
  }
}

function safeParseClassId(
  clientPayload: string | null | undefined
): string | null {
  if (!clientPayload) {
    return null;
  }
  try {
    const parsed = JSON.parse(clientPayload) as { classId?: string };
    return parsed.classId ?? null;
  } catch {
    return null;
  }
}
