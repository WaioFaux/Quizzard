/**
 * AI Chat Service
 * Handles the two-phase conversation flow for lecture generation
 */

import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { callGeminiForJSON } from "./gemini-client";
import {
  ChatMessage,
  LectureProposal,
  LectureFormat,
  getInitialAnalysisPrompt,
  getFollowUpPrompt,
  getConfirmPrompt,
} from "./chat-prompts";
import { logger } from "../utils/logger";

// Chat state stored in memory (in production, use Redis or database)
interface ChatSession {
  materialId: string;
  classId: string;
  teacherId: string;
  messages: ChatMessage[];
  proposals: LectureProposal[];
  phase: "analyzing" | "reviewing" | "generating";
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for chat sessions (key: `${teacherId}-${materialId}`)
const chatSessions = new Map<string, ChatSession>();

function getSessionKey(teacherId: string, materialId: string): string {
  return `${teacherId}-${materialId}`;
}

function getOrCreateSession(
  teacherId: string,
  classId: string,
  materialId: string
): ChatSession {
  const key = getSessionKey(teacherId, materialId);

  if (chatSessions.has(key)) {
    return chatSessions.get(key)!;
  }

  const session: ChatSession = {
    materialId,
    classId,
    teacherId,
    messages: [],
    proposals: [],
    phase: "analyzing",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  chatSessions.set(key, session);
  return session;
}

function getSession(
  teacherId: string,
  materialId: string
): ChatSession | null {
  const key = getSessionKey(teacherId, materialId);
  return chatSessions.get(key) || null;
}

function updateSession(session: ChatSession): void {
  session.updatedAt = new Date();
  const key = getSessionKey(session.teacherId, session.materialId);
  chatSessions.set(key, session);
}

function clearSession(teacherId: string, materialId: string): void {
  const key = getSessionKey(teacherId, materialId);
  chatSessions.delete(key);
}

interface ChatResponse {
  message: string;
  proposals: LectureProposal[];
  readyToConfirm: boolean;
  lectures?: LectureFormat[];
}

interface ChatResult {
  response: string;
  proposals: LectureProposal[];
  readyToConfirm: boolean;
  lectures?: LectureFormat[];
}

/**
 * Start a new chat session for lecture planning
 */
export async function startChatSession(
  teacherId: string,
  classId: string,
  materialId: string
): Promise<ChatResult> {
  console.log("[AI Chat] Starting new chat session", {
    teacherId,
    classId,
    materialId,
    timestamp: new Date().toISOString(),
  });

  // Verify material exists and is accessible
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      class: { select: { teacherId: true, id: true } },
    },
  });

  if (!material) {
    console.error("[AI Chat] Material not found:", materialId);
    throw new NotFoundError("Material");
  }

  if (material.class.teacherId !== teacherId) {
    console.error("[AI Chat] Unauthorized access attempt", {
      teacherId,
      materialOwner: material.class.teacherId,
    });
    throw new AuthorizationError("You do not have access to this material");
  }

  if (material.status !== "PROCESSED" || !material.extractedText) {
    console.error("[AI Chat] Material not ready", {
      materialId,
      status: material.status,
    });
    throw new Error("Material is still being processed or has no extracted text");
  }

  // Create or get session
  const session = getOrCreateSession(teacherId, classId, materialId);

  // Add initial assistant message if session is new
  if (session.messages.length === 0) {
    try {
      const prompt = getInitialAnalysisPrompt(material.extractedText);
      const aiResponse = await callGeminiForJSON<ChatResponse>(prompt);

      session.messages.push({
        role: "assistant",
        content: aiResponse.message,
      });
      session.proposals = aiResponse.proposals || [];
      session.phase = "reviewing";
      updateSession(session);

      logger.info("chat.session.started", {
        teacherId,
        materialId,
        proposalCount: session.proposals.length,
      });

      return {
        response: aiResponse.message,
        proposals: session.proposals,
        readyToConfirm: aiResponse.readyToConfirm ?? true,
      };
    } catch (error) {
      console.error("[AI Chat] Error calling Gemini:", error);
      if (error instanceof Error) {
        console.error("[AI Chat] Stack:", error.stack);
      }
      throw error;
    }
  }

  // Return existing session state
  const lastAssistantMessage = session.messages
    .filter((m) => m.role === "assistant")
    .pop();

  return {
    response: lastAssistantMessage?.content || "Welcome back to your chat session.",
    proposals: session.proposals,
    readyToConfirm: session.phase === "reviewing" && session.proposals.length > 0,
  };
}

/**
 * Send a message in an existing chat session
 */
export async function sendChatMessage(
  teacherId: string,
  materialId: string,
  userMessage: string
): Promise<ChatResult> {
  console.log("[AI Chat] User message received", {
    teacherId,
    materialId,
    messageLength: userMessage.length,
    timestamp: new Date().toISOString(),
  });

  const session = getSession(teacherId, materialId);

  if (!session) {
    console.error("[AI Chat] Session not found:", { teacherId, materialId });
    throw new Error("Chat session not found. Please start a new session.");
  }

  // Add user message to history
  session.messages.push({
    role: "user",
    content: userMessage,
  });

  try {
    const prompt = getFollowUpPrompt(session.proposals, userMessage);
    const aiResponse = await callGeminiForJSON<ChatResponse>(prompt);

    session.messages.push({
      role: "assistant",
      content: aiResponse.message,
    });

    if (aiResponse.proposals) {
      session.proposals = aiResponse.proposals;
    }

    updateSession(session);

    logger.info("chat.message.sent", {
      teacherId,
      materialId,
      proposalCount: session.proposals.length,
    });

    return {
      response: aiResponse.message,
      proposals: session.proposals,
      readyToConfirm: aiResponse.readyToConfirm ?? session.proposals.length > 0,
    };
  } catch (error) {
    console.error("[AI Chat] Error in chat:", error);
    if (error instanceof Error) {
      console.error("[AI Chat] Stack:", error.stack);
    }
    throw error;
  }
}

/**
 * Confirm the lecture plan and generate lectures
 */
export async function confirmLecturePlan(
  teacherId: string,
  materialId: string
): Promise<ChatResult & { createdLectures: Array<{ lectureId: string; quizId: string }> }> {
  console.log("[AI Chat] Plan confirmation requested", {
    teacherId,
    materialId,
    timestamp: new Date().toISOString(),
  });

  const session = getSession(teacherId, materialId);

  if (!session) {
    console.error("[AI Chat] Session not found for confirmation:", {
      teacherId,
      materialId,
    });
    throw new Error("Chat session not found. Please start a new session.");
  }

  if (session.proposals.length === 0) {
    console.error("[AI Chat] No proposals to confirm");
    throw new Error("No lecture proposals available to confirm");
  }

  session.phase = "generating";
  updateSession(session);

  try {
    const prompt = getConfirmPrompt(session.proposals);
    const aiResponse = await callGeminiForJSON<{
      message: string;
      lectures: LectureFormat[];
    }>(prompt);

    if (!aiResponse.lectures || aiResponse.lectures.length === 0) {
      throw new Error("No lectures generated from AI response");
    }

    // Create lectures and quizzes in database
    const createdLectures = await createLecturesFromFormat(
      session.classId,
      teacherId,
      materialId,
      aiResponse.lectures
    );

    // Add confirmation message
    session.messages.push({
      role: "assistant",
      content: aiResponse.message || "Your lecture plan has been confirmed! Lectures have been created.",
    });

    updateSession(session);

    logger.info("chat.plan.confirmed", {
      teacherId,
      materialId,
      lectureCount: createdLectures.length,
    });

    return {
      response: aiResponse.message || "Lectures created successfully!",
      proposals: session.proposals,
      readyToConfirm: false,
      lectures: aiResponse.lectures,
      createdLectures,
    };
  } catch (error) {
    console.error("[AI Chat] Error generating lectures:", error);
    if (error instanceof Error) {
      console.error("[AI Chat] Stack:", error.stack);
    }
    session.phase = "reviewing";
    updateSession(session);
    throw error;
  }
}

/**
 * Update lecture proposals (edit mode)
 */
export async function updateProposals(
  teacherId: string,
  materialId: string,
  newProposals: LectureProposal[]
): Promise<ChatResult> {
  console.log("[AI Chat] Proposals updated", {
    teacherId,
    materialId,
    proposalCount: newProposals.length,
    timestamp: new Date().toISOString(),
  });

  const session = getSession(teacherId, materialId);

  if (!session) {
    console.error("[AI Chat] Session not found for proposal update:", {
      teacherId,
      materialId,
    });
    throw new Error("Chat session not found. Please start a new session.");
  }

  session.proposals = newProposals;
  updateSession(session);

  return {
    response: "Proposals updated. Click 'Confirm Plan' when ready.",
    proposals: session.proposals,
    readyToConfirm: true,
  };
}

/**
 * End a chat session
 */
export function endChatSession(teacherId: string, materialId: string): void {
  console.log("[AI Chat] Session ended", {
    teacherId,
    materialId,
    timestamp: new Date().toISOString(),
  });

  clearSession(teacherId, materialId);
}

/**
 * Get current chat session state
 */
export function getChatSessionState(
  teacherId: string,
  materialId: string
): ChatResult | null {
  const session = getSession(teacherId, materialId);

  if (!session) {
    return null;
  }

  return {
    response: "",
    proposals: session.proposals,
    readyToConfirm: session.phase === "reviewing" && session.proposals.length > 0,
  };
}

// Helper function to create lectures from format
async function createLecturesFromFormat(
  classId: string,
  teacherId: string,
  materialId: string,
  lectures: LectureFormat[]
): Promise<Array<{ lectureId: string; quizId: string }>> {
  const results: Array<{ lectureId: string; quizId: string }> = [];

  // Get current max order
  const lastLecture = await prisma.lecture.findFirst({
    where: { classId },
    orderBy: { order: "desc" },
  });
  let currentOrder = (lastLecture?.order ?? 0);

  for (const lectureFormat of lectures) {
    currentOrder += 1;

    // Create lecture
    const lecture = await prisma.lecture.create({
      data: {
        classId,
        materialId,
        title: lectureFormat.title,
        sourceRef: lectureFormat.sourceRef,
        order: currentOrder,
      },
    });

    // Create associated quiz draft
    const quiz = await prisma.quiz.create({
      data: {
        lectureId: lecture.id,
        instructions: lectureFormat.quiz?.instructions || `Questions for: ${lectureFormat.title}`,
        questionsPerAttempt: lectureFormat.quiz?.questionCount || 5,
        timeLimitMinutes: 30,
      },
    });

    results.push({
      lectureId: lecture.id,
      quizId: quiz.id,
    });

    console.log("[AI Chat] Created lecture:", {
      lectureId: lecture.id,
      quizId: quiz.id,
      title: lectureFormat.title,
    });
  }

  return results;
}
