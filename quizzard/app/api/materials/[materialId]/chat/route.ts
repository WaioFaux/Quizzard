import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import {
  startChatSession,
  sendChatMessage,
  confirmLecturePlan,
  updateProposals,
} from "@/lib/ai/chat.service";
import { LectureProposalsSchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/utils/logger";

// The AI round trip can take a while - give the function enough room to
// finish and answer with a real error instead of being killed mid-flight.
export const maxDuration = 60;

/**
 * GET - Chat state is held by the client, so there is nothing to restore here.
 */
export async function GET(req: NextRequest) {
  try {
    await requireTeacher();

    return Response.json({
      data: null,
      message:
        "No server-side chat session. The client keeps the lecture plan and sends it back with every request.",
    });
  } catch (err) {
    console.error("[API /materials/[materialId]/chat] GET error:", err);
    return handleApiError(err);
  }
}

/**
 * POST - Start a new chat session or send a message
 * Body: { action: "start" | "message" | "confirm" | "update" | "end", message?: string, materialId: string, classId?: string, proposals?: LectureProposal[] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacher();
    const body = await req.json();

    const { action, materialId, classId, message, proposals } = body;

    if (!materialId) {
      throw new ValidationError("Cần có materialId");
    }

    if (!action) {
      throw new ValidationError("Cần có action");
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
          throw new ValidationError("Cần có classId để bắt đầu phiên trò chuyện");
        }
        result = await startChatSession(session.userId, classId, materialId, req.headers);
        logger.info("api.chat.start", {
          userId: session.userId,
          materialId,
          classId,
        });
        break;
      }

      case "message": {
        if (!message || typeof message !== "string") {
          throw new ValidationError("Cần có message cho thao tác trò chuyện");
        }
        result = await sendChatMessage(
          session.userId,
          materialId,
          message,
          parseProposals(proposals),
          req.headers
        );
        logger.info("api.chat.message", {
          userId: session.userId,
          materialId,
          messageLength: message.length,
        });
        break;
      }

      case "confirm": {
        result = await confirmLecturePlan(
          session.userId,
          materialId,
          parseProposals(proposals, true),
          req.headers
        );
        logger.info("api.chat.confirm", {
          userId: session.userId,
          materialId,
          lectureCount: result.createdLectures?.length,
        });
        break;
      }

      case "update": {
        result = updateProposals(parseProposals(proposals, true));
        logger.info("api.chat.update", {
          userId: session.userId,
          materialId,
          proposalCount: result.proposals.length,
        });
        break;
      }

      case "end": {
        // Nothing to clean up - the client owns the conversation state.
        return Response.json({ data: { success: true, message: "Đã kết thúc phiên trò chuyện" } });
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

/**
 * Validate the proposals sent by the client. They are untrusted input: the
 * client owns the plan, the server must not accept anything malformed.
 */
function parseProposals(proposals: unknown, required = false) {
  if (proposals === undefined || proposals === null) {
    if (required) {
      throw new ValidationError("Cần có mảng proposals cho thao tác này");
    }
    return [];
  }

  const parsed = LectureProposalsSchema.safeParse(proposals);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(
      issue ? `${issue.path.join(".") || "proposals"}: ${issue.message}` : "Đề xuất không hợp lệ"
    );
  }

  return parsed.data;
}
