/**
 * Question Bank Chat Service
 * Handles the conversational workflow for generating quiz questions
 * 
 * AI Processing Phases:
 * 1. Session Start - Initialize chat and get AI suggestions
 * 2. Message Processing - Handle user requests, update plan
 * 3. Generation - Call Gemini for question generation
 * 4. Recheck - Blind recheck each question for quality
 * 5. Database - Save questions to the database
 */

import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { callGeminiForJSON } from "./gemini-client";
import {
  QuestionGenerationConfig,
  QuestionProposal,
  GenerationPlan,
  getInitialConfigPrompt,
  getGenerationPrompt,
  getAdjustPrompt,
} from "./qb-chat-prompts";
import { generateFullQuestionBank, blindRecheck, type GeneratedQuestion } from "./gemini-client";
import { createQuestion } from "../services/question-bank.service";
import { QuestionStatus, QuizStatus } from "@prisma/client";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[QB Chat Service]";
const LOG_PHASE = {
  SESSION_START: "SESSION_START",
  MESSAGE_PROCESS: "MESSAGE_PROCESS",
  PLAN_UPDATE: "PLAN_UPDATE",
  GENERATION_START: "GENERATION_START",
  AI_CALL: "AI_CALL",
  RECHECK: "RECHECK",
  DATABASE_SAVE: "DATABASE_SAVE",
  GENERATION_COMPLETE: "GENERATION_COMPLETE",
  ERROR: "ERROR",
} as const;

// Chat state interface
interface QBChatSession {
  quizId: string;
  classId: string;
  teacherId: string;
  topic: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  plan: GenerationPlan | null;
  phase: "configuring" | "generating" | "reviewing" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for chat sessions (key: `${teacherId}-${quizId}`)
const chatSessions = new Map<string, QBChatSession>();

function getSessionKey(teacherId: string, quizId: string): string {
  return `${teacherId}-${quizId}`;
}

function getOrCreateSession(
  teacherId: string,
  quizId: string,
  topic: string,
  classId: string
): QBChatSession {
  const key = getSessionKey(teacherId, quizId);

  if (chatSessions.has(key)) {
    return chatSessions.get(key)!;
  }

  const session: QBChatSession = {
    quizId,
    classId,
    teacherId,
    topic,
    messages: [],
    plan: null,
    phase: "configuring",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  chatSessions.set(key, session);
  return session;
}

function getSession(teacherId: string, quizId: string): QBChatSession | null {
  const key = getSessionKey(teacherId, quizId);
  return chatSessions.get(key) || null;
}

function updateSession(session: QBChatSession): void {
  session.updatedAt = new Date();
  const key = getSessionKey(session.teacherId, session.quizId);
  chatSessions.set(key, session);
}

function clearSession(teacherId: string, quizId: string): void {
  const key = getSessionKey(teacherId, quizId);
  chatSessions.delete(key);
}

interface ChatResponse {
  message: string;
  suggestions?: {
    count: number;
    questionTypes: string[];
    difficulty: string;
  };
  questions?: QuestionProposal[];
  updatedPlan?: GenerationPlan | null;
  readyToGenerate?: boolean;
  awaitingConfig?: boolean;
}

export interface QBChatResult {
  response: string;
  plan: GenerationPlan | null;
  questions?: QuestionProposal[];
  readyToGenerate: boolean;
  createdQuestions?: number;
}

/**
 * Start a new chat session for question generation
 */
export async function startQBChatSession(
  teacherId: string,
  quizId: string
): Promise<QBChatResult> {
  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Starting new chat session`, {
    teacherId,
    quizId,
    timestamp: new Date().toISOString(),
  });

  // Verify quiz exists and is accessible
  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Fetching quiz details`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          class: { select: { teacherId: true, id: true } },
          material: { select: { extractedText: true } },
        },
      },
    },
  });

  if (!quiz) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Quiz not found:`, quizId);
    throw new NotFoundError("Quiz");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Unauthorized access attempt`, {
      teacherId,
      quizOwner: quiz.lecture.class.teacherId,
      quizId,
    });
    throw new AuthorizationError("You do not have access to this quiz");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Quiz is published, cannot modify:`, quizId);
    throw new AuthorizationError("Cannot modify a published quiz");
  }

  // Get existing questions to avoid duplication
  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Checking existing questions`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  const existingQuestions = await prisma.questionBankItem.findMany({
    where: { quizId },
    select: { content: true },
  });

  const existingPrompts = existingQuestions
    .map((q) => {
      const content = q.content as Record<string, unknown>;
      return String(content.prompt || content.promptTemplate || "");
    })
    .filter(Boolean);

  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Found ${existingPrompts.length} existing questions`, {
    quizId,
    existingCount: existingPrompts.length,
    timestamp: new Date().toISOString(),
  });

  // Create session
  const session = getOrCreateSession(
    teacherId,
    quizId,
    quiz.instructions,
    quiz.lecture.class.id
  );

  // If new session, generate initial greeting
  if (session.messages.length === 0) {
    console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] New session - generating AI greeting`, {
      quizId,
      topic: quiz.instructions,
      hasMaterial: !!quiz.lecture.material?.extractedText,
      materialLength: quiz.lecture.material?.extractedText?.length ?? 0,
      timestamp: new Date().toISOString(),
    });

    try {
      console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Building initial config prompt`, {
        quizId,
        timestamp: new Date().toISOString(),
      });

      const prompt = getInitialConfigPrompt(
        quiz.instructions,
        existingPrompts,
        quiz.lecture.material?.extractedText
      );

      console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Calling Gemini for initial config`, {
        quizId,
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
      });

      const aiResponse = await callGeminiForJSON<ChatResponse>(prompt);

      console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Received AI response`, {
        quizId,
        hasMessage: !!aiResponse.message,
        hasSuggestions: !!aiResponse.suggestions,
        timestamp: new Date().toISOString(),
      });

      session.messages.push({
        role: "assistant",
        content: aiResponse.message,
      });

      if (aiResponse.suggestions) {
        console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] AI provided suggestions`, {
          quizId,
          suggestedCount: aiResponse.suggestions.count,
          suggestedTypes: aiResponse.suggestions.questionTypes,
          suggestedDifficulty: aiResponse.suggestions.difficulty,
          timestamp: new Date().toISOString(),
        });

        session.plan = {
          count: aiResponse.suggestions.count,
          questionTypes: aiResponse.suggestions.questionTypes,
          difficulty: aiResponse.suggestions.difficulty as "easy" | "medium" | "hard",
        };
      }

      session.phase = "configuring";
      updateSession(session);

      logger.info("qb.chat.session.started", {
        teacherId,
        quizId,
        hasPlan: !!session.plan,
      });

      console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Session started successfully`, {
        quizId,
        hasPlan: !!session.plan,
        phase: session.phase,
        timestamp: new Date().toISOString(),
      });

      return {
        response: aiResponse.message,
        plan: session.plan,
        readyToGenerate: false,
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Error generating initial prompt:`, error);
      if (error instanceof Error) {
        console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Stack:`, error.stack);
      }
      throw error;
    }
  }

  // Return existing session
  const lastAssistantMessage = session.messages
    .filter((m) => m.role === "assistant")
    .pop();

  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Returning existing session`, {
    quizId,
    messageCount: session.messages.length,
    phase: session.phase,
    timestamp: new Date().toISOString(),
  });

  return {
    response: lastAssistantMessage?.content || "Welcome back to question generation.",
    plan: session.plan,
    readyToGenerate: session.phase === "reviewing" && session.plan !== null,
  };
}

/**
 * Send a message in the chat session
 */
export async function sendQBChatMessage(
  teacherId: string,
  quizId: string,
  userMessage: string
): Promise<QBChatResult> {
  console.log(`${LOG_PREFIX} [${LOG_PHASE.MESSAGE_PROCESS}] User message received`, {
    quizId,
    messageLength: userMessage.length,
    messagePreview: userMessage.substring(0, 100),
    timestamp: new Date().toISOString(),
  });

  const session = getSession(teacherId, quizId);

  if (!session) {
    console.warn(`${LOG_PREFIX} [${LOG_PHASE.MESSAGE_PROCESS}] Session not found, starting new one`, {
      quizId,
      timestamp: new Date().toISOString(),
    });
    return startQBChatSession(teacherId, quizId);
  }

  // Add user message
  session.messages.push({
    role: "user",
    content: userMessage,
  });

  console.log(`${LOG_PREFIX} [${LOG_PHASE.MESSAGE_PROCESS}] Processing message`, {
    quizId,
    sessionPhase: session.phase,
    hasPlan: !!session.plan,
    messageCount: session.messages.length,
    timestamp: new Date().toISOString(),
  });

  try {
    // If we have a plan and user is ready to generate
    if (session.plan && userMessage.toLowerCase().includes("generate")) {
      console.log(`${LOG_PREFIX} [${LOG_PHASE.MESSAGE_PROCESS}] User wants to generate questions`, {
        quizId,
        plan: session.plan,
        timestamp: new Date().toISOString(),
      });

      return await generateQuestions(teacherId, quizId);
    }

    // Otherwise, adjust the plan
    console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Calling Gemini to adjust plan`, {
      quizId,
      promptPlan: session.plan,
      timestamp: new Date().toISOString(),
    });

    const prompt = getAdjustPrompt(session.plan!, userMessage);
    const aiResponse = await callGeminiForJSON<ChatResponse>(prompt);

    console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Received plan adjustment response`, {
      quizId,
      hasResponse: !!aiResponse.message,
      hasUpdatedPlan: !!aiResponse.updatedPlan,
      readyToGenerate: aiResponse.readyToGenerate,
      timestamp: new Date().toISOString(),
    });

    session.messages.push({
      role: "assistant",
      content: aiResponse.message,
    });

    if (aiResponse.updatedPlan) {
      console.log(`${LOG_PREFIX} [${LOG_PHASE.PLAN_UPDATE}] Plan was updated`, {
        quizId,
        oldPlan: session.plan,
        newPlan: aiResponse.updatedPlan,
        timestamp: new Date().toISOString(),
      });
      session.plan = aiResponse.updatedPlan;
    }

    session.phase = "reviewing";
    updateSession(session);

    console.log(`${LOG_PREFIX} [${LOG_PHASE.MESSAGE_PROCESS}] Message processed successfully`, {
      quizId,
      readyToGenerate: aiResponse.readyToGenerate,
      timestamp: new Date().toISOString(),
    });

    return {
      response: aiResponse.message,
      plan: session.plan,
      readyToGenerate: aiResponse.readyToGenerate ?? session.plan !== null,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Error processing message:`, error);
    if (error instanceof Error) {
      console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Stack:`, error.stack);
    }
    throw error;
  }
}

/**
 * Update the generation plan directly
 */
export async function updateQBPlan(
  teacherId: string,
  quizId: string,
  newPlan: GenerationPlan
): Promise<QBChatResult> {
  console.log("[QB Chat] Updating generation plan", {
    quizId,
    newPlan,
    timestamp: new Date().toISOString(),
  });

  const session = getSession(teacherId, quizId);

  if (!session) {
    console.error("[QB Chat] Session not found for plan update");
    throw new Error("Chat session not found. Please start a new session.");
  }

  session.plan = newPlan;
  session.phase = "reviewing";
  updateSession(session);

  return {
    response: "Plan updated. Click 'Generate Questions' when ready.",
    plan: session.plan,
    readyToGenerate: true,
  };
}

/**
 * Generate questions based on the current plan
 */
export async function generateQuestions(
  teacherId: string,
  quizId: string
): Promise<QBChatResult & { createdQuestions?: number }> {
  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Starting question generation`, {
    quizId,
    teacherId,
    timestamp: new Date().toISOString(),
  });

  const session = getSession(teacherId, quizId);

  if (!session || !session.plan) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] No plan available for generation`);
    throw new Error("No generation plan. Please configure first.");
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Plan details`, {
    quizId,
    count: session.plan.count,
    questionTypes: session.plan.questionTypes,
    difficulty: session.plan.difficulty,
    customInstructions: session.plan.customInstructions,
    timestamp: new Date().toISOString(),
  });

  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Fetching quiz and material`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          material: { select: { extractedText: true } },
        },
      },
    },
  });

  if (!quiz) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Quiz not found during generation:`, quizId);
    throw new NotFoundError("Quiz");
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Material info`, {
    quizId,
    hasMaterial: !!quiz.lecture.material?.extractedText,
    materialLength: quiz.lecture.material?.extractedText?.length ?? 0,
    timestamp: new Date().toISOString(),
  });

  session.phase = "generating";
  updateSession(session);

  let questionsFromAI: QuestionProposal[] = [];

  try {
    // Generate questions using Gemini
    console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Building generation prompt`, {
      quizId,
      topic: session.topic,
      count: session.plan.count,
      types: session.plan.questionTypes,
      difficulty: session.plan.difficulty,
      timestamp: new Date().toISOString(),
    });

    const config: QuestionGenerationConfig = {
      count: session.plan.count,
      questionTypes: session.plan.questionTypes as QuestionGenerationConfig["questionTypes"],
      difficulty: session.plan.difficulty as "easy" | "medium" | "hard",
      customInstructions: session.plan.customInstructions,
    };

    const prompt = getGenerationPrompt(
      session.topic,
      config,
      quiz.lecture.material?.extractedText
    );

    console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Calling Gemini API for question generation`, {
      quizId,
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    });

    const aiResponse = await callGeminiForJSON<{
      message: string;
      questions: QuestionProposal[];
    }>(prompt);

    console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Received response from Gemini`, {
      quizId,
      hasMessage: !!aiResponse.message,
      questionCount: aiResponse.questions?.length ?? 0,
      timestamp: new Date().toISOString(),
    });

    if (!aiResponse.questions || aiResponse.questions.length === 0) {
      console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Gemini returned no questions`, {
        quizId,
        response: aiResponse,
        timestamp: new Date().toISOString(),
      });
      throw new Error("No questions generated by AI");
    }

    questionsFromAI = aiResponse.questions;

    // Create questions in database with recheck
    console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Starting to create questions in database`, {
      quizId,
      totalQuestions: questionsFromAI.length,
      timestamp: new Date().toISOString(),
    });

    let createdCount = 0;
    let recheckSuccessCount = 0;
    let recheckFlaggedCount = 0;
    let failedCount = 0;
    const createdIds: string[] = [];

    for (let i = 0; i < questionsFromAI.length; i++) {
      const q = questionsFromAI[i];

      console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Processing question ${i + 1}/${questionsFromAI.length}`, {
        quizId,
        questionIndex: i,
        questionType: q.type,
        hasPrompt: !!q.prompt,
        timestamp: new Date().toISOString(),
      });

      try {
        // Validate question structure
        if (!q.type || !q.prompt) {
          console.warn(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Invalid question structure at index ${i}:`, {
            quizId,
            questionIndex: i,
            question: q,
            timestamp: new Date().toISOString(),
          });
          failedCount++;
          continue;
        }

        // Blind recheck
        console.log(`${LOG_PREFIX} [${LOG_PHASE.RECHECK}] Performing blind recheck on question ${i + 1}`, {
          quizId,
          questionIndex: i,
          questionType: q.type,
          timestamp: new Date().toISOString(),
        });

        const recheck = await blindRecheck(q as unknown as GeneratedQuestion);

        console.log(`${LOG_PREFIX} [${LOG_PHASE.RECHECK}] Recheck complete for question ${i + 1}`, {
          quizId,
          questionIndex: i,
          flagged: recheck.flagged,
          reason: recheck.reason,
          timestamp: new Date().toISOString(),
        });

        if (recheck.flagged) {
          recheckFlaggedCount++;
        } else {
          recheckSuccessCount++;
        }

        const status: QuestionStatus = recheck.flagged
          ? QuestionStatus.FLAGGED_FOR_REVIEW
          : QuestionStatus.DRAFT;

        console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Saving question ${i + 1} to database`, {
          quizId,
          questionIndex: i,
          status,
          timestamp: new Date().toISOString(),
        });

        // Create question in DB
        const dbQuestion = await createQuestion(quizId, teacherId, {
          type: q.type,
          content: q as unknown as Record<string, unknown>,
          status,
          generationInstruction: session.plan.customInstructions ?? null,
        });

        createdIds.push(dbQuestion.id);
        createdCount++;

        console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Question ${i + 1} saved successfully`, {
          quizId,
          questionId: dbQuestion.id,
          status,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        failedCount++;
        console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Error creating question ${i + 1}:`, {
          quizId,
          questionIndex: i,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        // Continue with other questions
      }
    }

    // Add assistant message
    session.messages.push({
      role: "assistant",
      content: aiResponse.message,
    });

    session.phase = "completed";
    updateSession(session);

    console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_COMPLETE}] Question generation completed`, {
      quizId,
      requested: questionsFromAI.length,
      created: createdCount,
      failed: failedCount,
      recheckFlagged: recheckFlaggedCount,
      recheckPassed: recheckSuccessCount,
      timestamp: new Date().toISOString(),
    });

    logger.info("qb.chat.generation.completed", {
      teacherId,
      quizId,
      requested: questionsFromAI.length,
      created: createdCount,
      failed: failedCount,
      flagged: recheckFlaggedCount,
    });

    return {
      response: aiResponse.message,
      plan: session.plan,
      questions: questionsFromAI,
      readyToGenerate: false,
      createdQuestions: createdCount,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Error during question generation:`, {
      quizId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    session.phase = "reviewing";
    updateSession(session);
    throw error;
  }
}

/**
 * End a chat session
 */
export function endQBChatSession(teacherId: string, quizId: string): void {
  console.log("[QB Chat] Session ended", {
    teacherId,
    quizId,
    timestamp: new Date().toISOString(),
  });

  clearSession(teacherId, quizId);
}

/**
 * Get current session state
 */
export function getQBChatSessionState(
  teacherId: string,
  quizId: string
): QBChatResult | null {
  const session = getSession(teacherId, quizId);

  if (!session) {
    return null;
  }

  return {
    response: "",
    plan: session.plan,
    readyToGenerate: session.phase === "reviewing" && session.plan !== null,
  };
}
