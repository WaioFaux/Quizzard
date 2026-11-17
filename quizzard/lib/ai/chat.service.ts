/**
 * AI Chat Service
 * Handles the two-phase conversation flow for lecture generation
 *
 * The conversation is stateless: the client holds the proposals and sends
 * them back with every request. Serverless functions are not guaranteed to
 * reuse the same instance between two requests, so a server-side session
 * store would silently lose the plan.
 *
 * Supports both OpenRouter and Gemini providers
 */

import { prisma } from "../db";
import { NotFoundError, AuthorizationError, ValidationError } from "../utils/errors";
import { callAIForJSON, getAISettings } from "./ai-client";
import { LectureFormatSchema } from "../validation/schemas";
import {
  LectureProposal,
  LectureFormat,
  getInitialAnalysisPrompt,
  getFollowUpPrompt,
  getConfirmPrompt,
} from "./chat-prompts";
import { logger } from "../utils/logger";
import { debugLog } from "../utils/debug-log";

const LOG_PREFIX = "[AI Chat]";

/** Hard limits so a runaway model cannot flood the database. */
const MAX_PROPOSALS = 50;
const MAX_LECTURES = 50;

/**
 * Budget for a single AI call in the planner. The route runs on Vercel's
 * 60 second function limit, so the AI call must leave room for the response
 * to be written.
 */
const AI_BUDGET_MS = 35_000;

export interface ChatResult {
  response: string;
  proposals: LectureProposal[];
  readyToConfirm: boolean;
  lectures?: LectureFormat[];
}

export interface ConfirmChatResult extends ChatResult {
  createdLectures: Array<{ lectureId: string; quizId: string }>;
}

/**
 * Load a material and verify the teacher owns the class it belongs to.
 * The class is derived from the material, never taken from the request body.
 */
async function loadOwnedMaterial(teacherId: string, materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      class: { select: { id: true, teacherId: true } },
    },
  });

  if (!material) {
    throw new NotFoundError("Tài liệu");
  }

  if (material.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không có quyền truy cập tài liệu này");
  }

  return material;
}

/**
 * Drop malformed proposals the model may have produced and cap the list.
 */
function normalizeProposals(
  proposals: unknown,
  fallback: LectureProposal[] = []
): LectureProposal[] {
  if (!Array.isArray(proposals)) {
    return fallback;
  }

  const normalized: LectureProposal[] = [];

  for (const entry of proposals) {
    if (!entry || typeof entry !== "object") continue;

    const proposal = entry as Partial<LectureProposal>;
    const title = typeof proposal.title === "string" ? proposal.title.trim() : "";
    if (!title) continue;

    const startPage = Number(proposal.startPage);
    const endPage = Number(proposal.endPage);
    if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) continue;

    normalized.push({
      title: title.slice(0, 200),
      startPage: Math.max(0, Math.round(startPage)),
      endPage: Math.max(0, Math.round(endPage)),
      description:
        typeof proposal.description === "string"
          ? proposal.description.slice(0, 1000)
          : undefined,
    });

    if (normalized.length >= MAX_PROPOSALS) break;
  }

  return normalized;
}

/**
 * Validate the lectures the model produced for a confirmed plan.
 *
 * The payload comes from a language model, so a single malformed entry must
 * not sink the whole plan: invalid entries are dropped and the valid ones
 * are kept. Numbers are coerced because models frequently send page ranges
 * and question counts as strings.
 */
function normalizeLectureFormats(value: unknown): LectureFormat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const lectures: LectureFormat[] = [];

  for (const entry of value.slice(0, MAX_LECTURES)) {
    const parsed = LectureFormatSchema.safeParse(entry);

    if (!parsed.success) {
      // #region agent log
      debugLog("H2", "lib/ai/chat.service.ts:normalizeLectureFormats", "dropped malformed lecture", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
        entry: JSON.stringify(entry).slice(0, 600),
      });
      // #endregion
      console.warn(`${LOG_PREFIX} [PLAN] Dropping malformed lecture`, {
        issues:
          parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        title:
          entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).title === "string"
            ? (entry as Record<string, unknown>).title
            : undefined,
      });
      continue;
    }

    lectures.push(parsed.data as LectureFormat);
  }

  return lectures;
}

/**
 * Start a lecture planning conversation for a material.
 */
export async function startChatSession(
  teacherId: string,
  classId: string,
  materialId: string,
  headers?: Headers
): Promise<ChatResult> {
  console.log(`${LOG_PREFIX} Starting chat session`, {
    teacherId,
    classId,
    materialId,
    timestamp: new Date().toISOString(),
  });

  const aiSettings = getAISettings(headers);

  const material = await loadOwnedMaterial(teacherId, materialId);

  if (material.status !== "PROCESSED" || !material.extractedText) {
    console.error(`${LOG_PREFIX} Material not ready`, {
      materialId,
      status: material.status,
    });
    throw new ValidationError(
      "Tài liệu này vẫn đang được xử lý. Vui lòng đợi xử lý xong trước khi lập kế hoạch buổi giảng."
    );
  }

  const prompt = getInitialAnalysisPrompt(material.extractedText);
  const aiResponse = await callAIForJSON<ChatResponse>(prompt, { ...aiSettings, budgetMs: AI_BUDGET_MS });

  const proposals = normalizeProposals(aiResponse.proposals);

  logger.info("chat.session.started", {
    teacherId,
    materialId,
    proposalCount: proposals.length,
    provider: aiSettings.provider,
    model: aiSettings.model,
  });

  return {
    response: aiResponse.message ?? "",
    proposals,
    readyToConfirm: aiResponse.readyToConfirm ?? proposals.length > 0,
  };
}

/**
 * Continue the conversation. The current proposals come from the client.
 */
export async function sendChatMessage(
  teacherId: string,
  materialId: string,
  userMessage: string,
  currentProposals: LectureProposal[],
  headers?: Headers
): Promise<ChatResult> {
  console.log(`${LOG_PREFIX} User message received`, {
    teacherId,
    materialId,
    messageLength: userMessage.length,
    timestamp: new Date().toISOString(),
  });

  const aiSettings = getAISettings(headers);

  // The material must still exist and belong to this teacher.
  await loadOwnedMaterial(teacherId, materialId);

  const prompt = getFollowUpPrompt(currentProposals, userMessage);
  const aiResponse = await callAIForJSON<ChatResponse>(prompt, { ...aiSettings, budgetMs: AI_BUDGET_MS });

  const proposals = normalizeProposals(aiResponse.proposals, currentProposals);

  logger.info("chat.message.sent", {
    teacherId,
    materialId,
    proposalCount: proposals.length,
  });

  return {
    response: aiResponse.message ?? "",
    proposals,
    readyToConfirm: aiResponse.readyToConfirm ?? proposals.length > 0,
  };
}

/**
 * Confirm the lecture plan and create the lectures with their quiz drafts.
 */
export async function confirmLecturePlan(
  teacherId: string,
  materialId: string,
  proposals: LectureProposal[],
  headers?: Headers
): Promise<ConfirmChatResult> {
  console.log(`${LOG_PREFIX} Plan confirmation requested`, {
    teacherId,
    materialId,
    proposalCount: proposals.length,
    timestamp: new Date().toISOString(),
  });

  if (proposals.length === 0) {
    throw new ValidationError("Không có đề xuất buổi giảng nào để xác nhận");
  }

  const aiSettings = getAISettings(headers);

  // Ownership check - the class is derived from the material.
  const material = await loadOwnedMaterial(teacherId, materialId);
  const classId = material.classId;

  // #region agent log
  debugLog("H1", "lib/ai/chat.service.ts:confirmLecturePlan", "confirm request received", {
    teacherId,
    materialId,
    classId,
    proposalCount: proposals.length,
    proposalTitles: proposals.map((p) => p.title),
    provider: aiSettings.provider,
    model: aiSettings.model,
    materialStatus: material.status,
  });
  // #endregion

  const prompt = getConfirmPrompt(proposals);
  const aiResponse = await callAIForJSON<{
    message: string;
    lectures: LectureFormat[];
  }>(prompt, { ...aiSettings, budgetMs: AI_BUDGET_MS });

  // #region agent log
  debugLog("H1", "lib/ai/chat.service.ts:confirmLecturePlan", "AI confirm response received", {
    responseType: aiResponse === null ? "null" : Array.isArray(aiResponse) ? "array" : typeof aiResponse,
    topLevelKeys:
      aiResponse && typeof aiResponse === "object" && !Array.isArray(aiResponse)
        ? Object.keys(aiResponse as Record<string, unknown>)
        : null,
    rawPreview: JSON.stringify(aiResponse).slice(0, 1200),
  });
  // #endregion

  const lectures = normalizeLectureFormats(aiResponse.lectures);

  // #region agent log
  debugLog("H2", "lib/ai/chat.service.ts:confirmLecturePlan", "lecture format normalization done", {
    inputCount: Array.isArray(aiResponse.lectures) ? aiResponse.lectures.length : -1,
    keptCount: lectures.length,
  });
  // #endregion

  if (lectures.length === 0) {
    throw new ValidationError(
      "AI không trả về buổi giảng nào dùng được cho kế hoạch này. Vui lòng thử lại."
    );
  }

  const createdLectures = await createLecturesFromFormat(
    classId,
    teacherId,
    materialId,
    lectures
  );

  logger.info("chat.plan.confirmed", {
    teacherId,
    materialId,
    lectureCount: createdLectures.length,
  });

  return {
    response:
      aiResponse.message ||
      "Kế hoạch buổi giảng đã được xác nhận! Các buổi giảng đã được tạo.",
    proposals,
    readyToConfirm: false,
    lectures,
    createdLectures,
  };
}

/**
 * Validate proposals edited in the UI. There is no server-side session to
 * update any more - the client owns the plan.
 */
export function updateProposals(
  proposals: LectureProposal[]
): { proposals: LectureProposal[] } {
  const normalized = normalizeProposals(proposals);

  if (normalized.length === 0) {
    throw new ValidationError("Cần ít nhất một đề xuất buổi giảng hợp lệ");
  }

  return { proposals: normalized };
}

interface ChatResponse {
  message: string;
  proposals: LectureProposal[];
  readyToConfirm: boolean;
}

// Helper function to create lectures from format
export async function createLecturesFromFormat(
  classId: string,
  teacherId: string,
  materialId: string,
  lectures: LectureFormat[]
): Promise<Array<{ lectureId: string; quizId: string }>> {
  // A transaction keeps the class consistent: either every lecture and its
  // quiz draft are created, or nothing is. A half-created plan used to be
  // left behind whenever one row failed.
  //
  // Prisma closes an interactive transaction after 5 seconds by default
  // (`maxTransactionTime`). Writing a plan means one round trip to the
  // database per row, and against the pooled Neon connection a round trip
  // costs a few hundred milliseconds - so a plan with several lectures ran
  // past that limit. Prisma then closed the transaction mid-write and the
  // next query failed with P2028 ("Transaction not found"), which surfaced
  // as an opaque 500. The timeout is raised here and every lecture is
  // written with a single nested create, so the transaction needs half as
  // many round trips.
  return prisma.$transaction(async (tx) => {
    const results: Array<{ lectureId: string; quizId: string }> = [];
    const txStart = Date.now();

    // Get current max order inside the transaction so the unique
    // (classId, order) constraint cannot be violated by a concurrent write.
    const lastLecture = await tx.lecture.findFirst({
      where: { classId },
      orderBy: { order: "desc" },
    });
    let currentOrder = lastLecture?.order ?? 0;

    // #region agent log
    debugLog("H3", "lib/ai/chat.service.ts:createLecturesFromFormat", "transaction started", {
      classId,
      lectureCount: lectures.length,
      lastLectureOrder: lastLecture?.order ?? null,
    });
    // #endregion

    try {
      for (const lectureFormat of lectures) {
        currentOrder += 1;

        const title =
          typeof lectureFormat?.title === "string" && lectureFormat.title.trim()
            ? lectureFormat.title.trim().slice(0, 200)
            : `Lecture ${currentOrder}`;

        // Create the lecture and its quiz draft in one statement - one round
        // trip to the database instead of two.
        const lecture = await tx.lecture.create({
          data: {
            classId,
            materialId,
            title,
            sourceRef: lectureFormat.sourceRef ?? undefined,
            order: currentOrder,
            quiz: {
              create: {
                instructions:
                  lectureFormat.quiz?.instructions ||
                  `Questions for: ${title}`,
                questionsPerAttempt: Math.min(
                  Math.max(lectureFormat.quiz?.questionCount || 5, 1),
                  100
                ),
                timeLimitMinutes: 30,
              },
            },
          },
          include: { quiz: true },
        });

        if (!lecture.quiz) {
          throw new Error(`Quiz draft was not created for lecture ${lecture.id}`);
        }

        results.push({
          lectureId: lecture.id,
          quizId: lecture.quiz.id,
        });

        console.log(`${LOG_PREFIX} Created lecture`, {
          lectureId: lecture.id,
          quizId: lecture.quiz.id,
          title,
          elapsedMs: Date.now() - txStart,
        });

        // #region agent log
        debugLog("H3", "lib/ai/chat.service.ts:createLecturesFromFormat", "lecture row created", {
          order: currentOrder,
          title,
          elapsedMs: Date.now() - txStart,
        });
        // #endregion
      }
    } catch (error) {
      const err = error as { name?: string; message?: string; code?: string; meta?: unknown };
      // #region agent log
      debugLog("H3", "lib/ai/chat.service.ts:createLecturesFromFormat", "transaction failed", {
        errorName: err?.name,
        errorMessage: err?.message,
        errorCode: err?.code,
        errorMeta: JSON.stringify(err?.meta ?? {}),
        elapsedMs: Date.now() - txStart,
        createdSoFar: results.length,
        stack: err?.message ? String(error).slice(0, 800) : undefined,
      });
      // #endregion
      throw error;
    }

    // #region agent log
    debugLog("H3", "lib/ai/chat.service.ts:createLecturesFromFormat", "transaction committed", {
      created: results.length,
      elapsedMs: Date.now() - txStart,
    });
    // #endregion

    return results;
  }, {
    // The default (5s) is too short for a plan with several lectures: the
    // transaction was closed by Prisma mid-write and the request failed with
    // P2028. `maxWait` is the time allowed to get a connection from the
    // pool, which is tight as well with a single-connection pool.
    timeout: 30_000,
    maxWait: 10_000,
  });
}
