import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import {
  startQBChatSession,
  sendQBChatMessage,
  updateQBPlan,
  generateQuestions,
  endQBChatSession,
  getQBChatSessionState,
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
      console.warn(`${LOG_PREFIX} [GET] Missing quizId parameter`);
      throw new ValidationError("quizId query parameter is required");
    }

    console.log(`${LOG_PREFIX} [GET] Fetching session state`, {
      userId: session.userId,
      quizId,
      timestamp: new Date().toISOString(),
    });

    const state = getQBChatSessionState(session.userId, quizId);

    if (!state) {
      console.log(`${LOG_PREFIX} [GET] No active session found`, {
        userId: session.userId,
        quizId,
        timestamp: new Date().toISOString(),
      });
      return Response.json({ data: null, message: "No active chat session" });
    }

    console.log(`${LOG_PREFIX} [GET] Session found`, {
      userId: session.userId,
      quizId,
      hasPlan: !!state.plan,
      readyToGenerate: state.readyToGenerate,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ data: state });
  } catch (err) {
    console.error(`${LOG_PREFIX} [GET] Error:`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return handleApiError(err);
  }
}

/**
 * POST - Start chat, send message, or generate questions
 * Body: { action: "start" | "message" | "updatePlan" | "generate" | "end", quizId: string, message?: string, plan?: GenerationPlan }
 */
export async function POST(req: NextRequest) {
  console.log(`${LOG_PREFIX} [POST] Request received`, {
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  try {
    const session = await requireTeacher();
    const body = await req.json();

    const { action, quizId, message, plan } = body;

    console.log(`${LOG_PREFIX} [POST] Parsed request body`, {
      userId: session.userId,
      action,
      quizId,
      hasMessage: !!message,
      messageLength: message?.length ?? 0,
      hasPlan: !!plan,
      timestamp: new Date().toISOString(),
    });

    if (!quizId) {
      console.warn(`${LOG_PREFIX} [POST] Missing quizId`);
      throw new ValidationError("quizId is required");
    }

    if (!action) {
      console.warn(`${LOG_PREFIX} [POST] Missing action`);
      throw new ValidationError("action is required");
    }

    console.log(`${LOG_PREFIX} [POST] Processing action: ${action}`, {
      userId: session.userId,
      quizId,
      action,
      timestamp: new Date().toISOString(),
    });

    let result;

    switch (action) {
      case "start": {
        console.log(`${LOG_PREFIX} [ACTION: start] Starting QB chat session`);
        const startTime = Date.now();

        result = await startQBChatSession(session.userId, quizId);

        console.log(`${LOG_PREFIX} [ACTION: start] Session started`, {
          userId: session.userId,
          quizId,
          durationMs: Date.now() - startTime,
          hasPlan: !!result.plan,
          timestamp: new Date().toISOString(),
        });

        logger.info("api.qb.chat.start", {
          userId: session.userId,
          quizId,
          durationMs: Date.now() - startTime,
        });
        break;
      }

      case "message": {
        if (!message || typeof message !== "string") {
          console.warn(`${LOG_PREFIX} [ACTION: message] Invalid message`);
          throw new ValidationError("message is required for chat action");
        }
        console.log(`${LOG_PREFIX} [ACTION: message] Sending chat message`);
        const startTime = Date.now();

        result = await sendQBChatMessage(session.userId, quizId, message);

        console.log(`${LOG_PREFIX} [ACTION: message] Message processed`, {
          userId: session.userId,
          quizId,
          durationMs: Date.now() - startTime,
          readyToGenerate: result.readyToGenerate,
          timestamp: new Date().toISOString(),
        });

        logger.info("api.qb.chat.message", {
          userId: session.userId,
          quizId,
          messageLength: message.length,
          durationMs: Date.now() - startTime,
        });
        break;
      }

      case "updatePlan": {
        if (!plan || typeof plan !== "object") {
          console.warn(`${LOG_PREFIX} [ACTION: updatePlan] Invalid plan`);
          throw new ValidationError("plan object is required for updatePlan action");
        }
        console.log(`${LOG_PREFIX} [ACTION: updatePlan] Updating plan`, {
          userId: session.userId,
          quizId,
          planDetails: plan,
          timestamp: new Date().toISOString(),
        });
        const startTime = Date.now();

        result = await updateQBPlan(session.userId, quizId, plan as GenerationPlan);

        console.log(`${LOG_PREFIX} [ACTION: updatePlan] Plan updated`, {
          userId: session.userId,
          quizId,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });

        logger.info("api.qb.chat.updatePlan", {
          userId: session.userId,
          quizId,
          plan,
          durationMs: Date.now() - startTime,
        });
        break;
      }

      case "generate": {
        console.log(`${LOG_PREFIX} [ACTION: generate] Starting question generation`);
        const startTime = Date.now();

        result = await generateQuestions(session.userId, quizId);

        console.log(`${LOG_PREFIX} [ACTION: generate] Generation completed`, {
          userId: session.userId,
          quizId,
          durationMs: Date.now() - startTime,
          createdQuestions: result.createdQuestions,
          timestamp: new Date().toISOString(),
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
        console.log(`${LOG_PREFIX} [ACTION: end] Ending chat session`);

        endQBChatSession(session.userId, quizId);

        console.log(`${LOG_PREFIX} [ACTION: end] Session ended`, {
          userId: session.userId,
          quizId,
          timestamp: new Date().toISOString(),
        });

        logger.info("api.qb.chat.end", {
          userId: session.userId,
          quizId,
        });
        return Response.json({ data: { success: true, message: "Chat session ended" } });
      }

      default:
        console.warn(`${LOG_PREFIX} [ACTION] Unknown action: ${action}`);
        throw new ValidationError(`Unknown action: ${action}`);
    }

    console.log(`${LOG_PREFIX} [POST] Action ${action} completed successfully`, {
      userId: session.userId,
      quizId,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ data: result });
  } catch (err) {
    console.error(`${LOG_PREFIX} [POST] Error during action:`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return handleApiError(err);
  }
}
