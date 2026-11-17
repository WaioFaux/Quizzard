import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import {
  startQBChatSession,
  saveQBPlan,
  generateQuestions,
  getTotalQuestionCount,
} from "@/lib/ai/qb-chat.service";
import { GenerationPlanSchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/utils/logger";

const LOG_PREFIX = "[API /quizzes/[quizId]/chat]";

// Generation runs several AI calls - give the function enough room to finish.
export const maxDuration = 60;

/**
 * GET - Chat state is held by the client, so there is nothing to restore here.
 */
export async function GET(req: NextRequest) {
  console.log(`${LOG_PREFIX} [GET] Request received`, {
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  try {
    await requireTeacher();

    return Response.json({
      data: null,
      message:
        "No server-side chat session. The client keeps the generation plan and sends it back with every request.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST - Start session, save plan, or generate questions
 * Body: { action: "start" | "savePlan" | "generate" | "end", quizId: string, plan?: GenerationPlan }
 */
export async function POST(req: NextRequest) {
  console.log(`${LOG_PREFIX} [POST] Request received`, {
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  try {
    const session = await requireTeacher();
    const body = await req.json();

    const { action, quizId, plan } = body;

    if (!quizId) {
      throw new ValidationError("Cần có quizId");
    }

    if (!action) {
      throw new ValidationError("Cần có action");
    }

    console.log(`${LOG_PREFIX} [POST] Action: ${action}`, {
      userId: session.userId,
      quizId,
      timestamp: new Date().toISOString(),
    });

    let result;

    switch (action) {
      case "start": {
        const startTime = Date.now();
        result = await startQBChatSession(session.userId, quizId);
        console.log(`${LOG_PREFIX} [ACTION: start] Done in ${Date.now() - startTime}ms`, { quizId });
        logger.info("api.qb.chat.start", { userId: session.userId, quizId, durationMs: Date.now() - startTime });
        break;
      }

      case "savePlan": {
        const parsedPlan = parsePlan(plan);
        result = await saveQBPlan(session.userId, quizId, parsedPlan);
        console.log(`${LOG_PREFIX} [ACTION: savePlan] Done`, { quizId });
        logger.info("api.qb.chat.savePlan", {
          userId: session.userId,
          quizId,
          totalQuestions: getTotalQuestionCount(parsedPlan),
        });
        break;
      }

      case "generate": {
        const parsedPlan = parsePlan(plan);
        const startTime = Date.now();
        result = await generateQuestions(
          session.userId,
          quizId,
          parsedPlan,
          req.headers
        );
        console.log(`${LOG_PREFIX} [ACTION: generate] Done in ${Date.now() - startTime}ms`, {
          quizId,
          created: result.createdQuestions,
        });
        logger.info("api.qb.chat.generate", {
          userId: session.userId,
          quizId,
          createdQuestions: result.createdQuestions,
          durationMs: Date.now() - startTime,
        });
        break;
      }

      case "end": {
        // Nothing to clean up - the client owns the plan.
        logger.info("api.qb.chat.end", { userId: session.userId, quizId });
        return Response.json({ data: { success: true } });
      }

      default:
        throw new ValidationError(`Unknown action: ${action}`);
    }

    return Response.json({ data: result });
  } catch (err) {
    console.error(`${LOG_PREFIX} [POST] Error:`, {
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
    return handleApiError(err);
  }
}

/**
 * Validate the generation plan sent by the client - it is untrusted input.
 */
function parsePlan(plan: unknown) {
  const parsed = GenerationPlanSchema.safeParse(plan);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(
      issue ? `${issue.path.join(".") || "plan"}: ${issue.message}` : "Kế hoạch tạo câu hỏi không hợp lệ"
    );
  }

  return parsed.data;
}
