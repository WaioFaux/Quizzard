import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import {
  startChatSession,
  sendChatMessage,
  confirmLecturePlan,
  updateProposals,
  endChatSession,
  getChatSessionState,
} from "@/lib/ai/chat.service";
import { logger } from "@/lib/utils/logger";

/**
 * GET - Get current chat session state
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId");

    if (!materialId) {
      throw new ValidationError("materialId query parameter is required");
    }

    const state = getChatSessionState(session.userId, materialId);

    if (!state) {
      return Response.json({ data: null, message: "No active chat session" });
    }

    return Response.json({ data: state });
  } catch (err) {
    console.error("[API /materials/[materialId]/chat] GET error:", err);
    if (err instanceof Error) {
      console.error("[API /materials/[materialId]/chat] Stack:", err.stack);
    }
    return handleApiError(err);
  }
}

/**
 * POST - Start a new chat session or send a message
 * Body: { action: "start" | "message" | "confirm" | "update", message?: string, materialId: string, classId: string, proposals?: LectureProposal[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const body = await req.json();

    const { action, materialId, classId, message, proposals } = body;

    if (!materialId) {
      throw new ValidationError("materialId is required");
    }

    if (!action) {
      throw new ValidationError("action is required");
    }

    console.log(`[API /materials/[materialId]/chat] Action: ${action}`, {
      userId: session.userId,
      materialId,
      classId,
      timestamp: new Date().toISOString(),
    });

    let result;

    switch (action) {
      case "start": {
        if (!classId) {
          throw new ValidationError("classId is required to start a chat session");
        }
        result = await startChatSession(session.userId, classId, materialId);
        logger.info("api.chat.start", {
          userId: session.userId,
          materialId,
          classId,
        });
        break;
      }

      case "message": {
        if (!message || typeof message !== "string") {
          throw new ValidationError("message is required for chat action");
        }
        result = await sendChatMessage(session.userId, materialId, message);
        logger.info("api.chat.message", {
          userId: session.userId,
          materialId,
          messageLength: message.length,
        });
        break;
      }

      case "confirm": {
        result = await confirmLecturePlan(session.userId, materialId);
        logger.info("api.chat.confirm", {
          userId: session.userId,
          materialId,
          lectureCount: result.createdLectures?.length,
        });
        break;
      }

      case "update": {
        if (!proposals || !Array.isArray(proposals)) {
          throw new ValidationError("proposals array is required for update action");
        }
        result = await updateProposals(session.userId, materialId, proposals);
        logger.info("api.chat.update", {
          userId: session.userId,
          materialId,
          proposalCount: proposals.length,
        });
        break;
      }

      case "end": {
        endChatSession(session.userId, materialId);
        logger.info("api.chat.end", {
          userId: session.userId,
          materialId,
        });
        return Response.json({ data: { success: true, message: "Chat session ended" } });
      }

      default:
        throw new ValidationError(`Unknown action: ${action}`);
    }

    return Response.json({ data: result });
  } catch (err) {
    console.error("[API /materials/[materialId]/chat] POST error:", err);
    if (err instanceof Error) {
      console.error("[API /materials/[materialId]/chat] Stack:", err.stack);
    }
    return handleApiError(err);
  }
}
