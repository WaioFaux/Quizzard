import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import {
  startQBChatSession,
  saveQBPlan,
  generateQuestions,
  endQBChatSession,
  getQBChatSessionState,
  getTotalQuestionCount,
} from "@/lib/ai/qb-chat.service";
import { GenerationPlan } from "@/lib/ai/qb-chat-prompts";
import { logger } from "@/lib/utils/logger";

const LOG_PREFIX = "[API /quizzes/[quizId]/chat]";

/**
 * GET - Get current chat session state
 */
export async function GET(req: NextRequest) {
  console.log(`${LOG_PREFIX} [GET] Request received`, {
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  try {
    const session = await requireTeacher();
    const { searchParams } = new URL(req.url);
    const quizId = searchParams.get("quizId");

    if (!quizId) {
      throw new ValidationError("quizId query parameter is required");
    }

    const state = getQBChatSessionState(session.userId, quizId);

    if (!state) {
      return Response.json({ data: null, message: "No active chat session" });
    }

    return Response.json({ data: state });
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
      throw new ValidationError("quizId is required");
    }

    if (!action) {
      throw new ValidationError("action is required");
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
        if (!plan || typeof plan !== "object") {
          throw new ValidationError("plan object is required for savePlan action");
        }
        result = saveQBPlan(session.userId, quizId, plan as GenerationPlan);
        console.log(`${LOG_PREFIX} [ACTION: savePlan] Done`, { quizId });
        logger.info("api.qb.chat.savePlan", {
          userId: session.userId,
          quizId,
          totalQuestions: getTotalQuestionCount(plan as GenerationPlan),
        });
        break;
      }

      case "generate": {
        const startTime = Date.now();
        result = await generateQuestions(session.userId, quizId);
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
        endQBChatSession(session.userId, quizId);
        console.log(`${LOG_PREFIX} [ACTION: end] Session ended`, { quizId });
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
