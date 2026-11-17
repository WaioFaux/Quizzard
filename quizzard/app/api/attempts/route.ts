import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { StartAttemptSchema } from "@/lib/validation/schemas";
import { ValidationError, AppError } from "@/lib/utils/errors";
import { startAttempt } from "@/lib/services/attempt.service";
import { logger } from "@/lib/utils/logger";
import { checkAttemptStartRateLimit } from "@/lib/middleware/rate-limit";
import { prisma } from "@/lib/db";
import { AttemptStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireStudent();
    const { searchParams } = new URL(req.url);
    const quizId = searchParams.get("quizId");

    const where: { studentId: string; quizId?: string } = {
      studentId: session.userId,
    };

    if (quizId) {
      where.quizId = quizId;
    }

    const attempts = await prisma.studentAttempt.findMany({
      where,
      include: {
        quiz: {
          select: {
            id: true,
            lecture: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      // StudentAttempt has no createdAt column; startedAt is the creation timestamp.
      orderBy: {
        startedAt: "desc",
      },
    });

    return Response.json({ data: attempts });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStudent();
    const body = await req.json();

    const parsed = StartAttemptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // Per-user rate limit: 3 attempt starts per user per quiz per minute
    checkAttemptStartRateLimit(session.userId, parsed.data.quizId);

    const attempt = await startAttempt(session.userId, parsed.data.quizId);

    logger.info("attempt.start", {
      userId: session.userId,
      attemptId: attempt.id,
      quizId: parsed.data.quizId,
    });

    return Response.json({ data: attempt }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError && err.name === "RateLimitExceededError") {
      const retryAfterMs = (err as { retryAfterMs: number }).retryAfterMs;
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return Response.json(
        { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }
    return handleApiError(err);
  }
}
