/**
 * Question Bank Chat Service
 * Handles the conversational workflow for generating quiz questions
 *
 * AI Processing Phases:
 * 1. Session Start - Return default config immediately (no blocking AI call)
 * 2. Generation - Call Gemini per type/difficulty bucket, blind recheck each question, save to DB
 */

import { prisma } from "../db";
import { NotFoundError, AuthorizationError } from "../utils/errors";
import { callGeminiForJSON } from "./gemini-client";
import {
  QuestionProposal,
  GenerationPlan,
  TypeConfig,
  QuestionType,
  DifficultyLevel,
  getTypeDifficultyPrompt,
} from "./qb-chat-prompts";
import { generateFullQuestionBank, blindRecheck, type GeneratedQuestion } from "./gemini-client";
import { createQuestion } from "../services/question-bank.service";
import { QuestionStatus, QuizStatus } from "@prisma/client";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[QB Chat Service]";
const LOG_PHASE = {
  SESSION_START: "SESSION_START",
  GENERATION_START: "GENERATION_START",
  AI_CALL: "AI_CALL",
  RECHECK: "RECHECK",
  DATABASE_SAVE: "DATABASE_SAVE",
  GENERATION_COMPLETE: "GENERATION_COMPLETE",
  ERROR: "ERROR",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Default generation plan factory
// ---------------------------------------------------------------------------

export function getDefaultGenerationPlan(): GenerationPlan {
  return {
    MCQ: { enabled: true, count: 5, distribution: { easy: 2, medium: 2, hard: 1 } },
    SHORT_ANSWER: { enabled: true, count: 5, distribution: { easy: 2, medium: 2, hard: 1 } },
    CALCULATION: { enabled: false, count: 0, distribution: { easy: 0, medium: 0, hard: 0 } },
  };
}

export function getTotalQuestionCount(plan: GenerationPlan): number {
  return plan.MCQ.count + plan.SHORT_ANSWER.count + plan.CALCULATION.count;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface QBChatResult {
  response: string;
  plan: GenerationPlan | null;
  readyToGenerate: boolean;
  createdQuestions?: number;
}

// ---------------------------------------------------------------------------
// Start a new chat session — NO blocking AI call
// ---------------------------------------------------------------------------

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

  // Create or return existing session
  const session = getOrCreateSession(
    teacherId,
    quizId,
    quiz.instructions,
    quiz.lecture.class.id
  );

  // If it's a brand new session, initialise with the default plan
  if (!session.plan) {
    session.plan = getDefaultGenerationPlan();
    session.messages.push({
      role: "assistant",
      content:
        "Welcome to the Question Generator! Configure how many questions you want for each type and difficulty, then click **Generate** when ready.",
    });
    updateSession(session);
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Session ready`, {
    quizId,
    hasPlan: !!session.plan,
    phase: session.phase,
    timestamp: new Date().toISOString(),
  });

  return {
    response: session.messages[session.messages.length - 1]?.content || "",
    plan: session.plan,
    readyToGenerate: session.plan !== null,
  };
}

// ---------------------------------------------------------------------------
// Save a plan from the UI
// ---------------------------------------------------------------------------

export function saveQBPlan(
  teacherId: string,
  quizId: string,
  plan: GenerationPlan
): QBChatResult {
  const session = getSession(teacherId, quizId);

  if (!session) {
    throw new Error("Chat session not found. Please start a new session.");
  }

  session.plan = plan;
  session.phase = "reviewing";
  updateSession(session);

  return {
    response: "Settings saved. Click **Generate Questions** when ready.",
    plan: session.plan,
    readyToGenerate: true,
  };
}

// ---------------------------------------------------------------------------
// Generate questions — loops over each type/difficulty bucket
// ---------------------------------------------------------------------------

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
    throw new Error("No generation plan. Please configure settings first.");
  }

  const plan = session.plan;

  // Fetch material for context
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
    throw new NotFoundError("Quiz");
  }

  const materialText = quiz.lecture.material?.extractedText;

  session.phase = "generating";
  updateSession(session);

  const enabledTypes: QuestionType[] = ["MCQ", "SHORT_ANSWER", "CALCULATION"].filter(
    (t) => plan[t as keyof GenerationPlan]?.enabled
  ) as QuestionType[];

  if (enabledTypes.length === 0) {
    throw new Error("No question types are enabled. Please enable at least one type.");
  }

  const difficulties: DifficultyLevel[] = ["easy", "medium", "hard"];

  // Collect all questions from all type/difficulty buckets
  let allQuestions: (QuestionProposal & { _bucket: string })[] = [];
  const buckets: Array<{ type: QuestionType; difficulty: DifficultyLevel; count: number }> = [];

  // Build the list of buckets we need to generate
  for (const type of enabledTypes) {
    const typeConfig = plan[type as keyof GenerationPlan] as TypeConfig;
    for (const diff of difficulties) {
      const count = typeConfig.distribution[diff];
      if (count > 0) {
        buckets.push({ type, difficulty: diff, count });
      }
    }
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Buckets to generate`, {
    quizId,
    buckets,
    timestamp: new Date().toISOString(),
  });

  // Generate each bucket in sequence
  for (let i = 0; i < buckets.length; i++) {
    const { type, difficulty, count } = buckets[i];

    console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Generating bucket ${i + 1}/${buckets.length}: ${count} ${difficulty} ${type}`, {
      quizId,
      type,
      difficulty,
      count,
      timestamp: new Date().toISOString(),
    });

    try {
      const prompt = getTypeDifficultyPrompt(
        session.topic,
        type,
        difficulty,
        count,
        plan.customInstructions,
        materialText
      );

      const response = await callGeminiForJSON<{ questions: QuestionProposal[] }>(prompt);

      const questions = (response.questions || []).map((q) => ({
        ...q,
        _bucket: `${type}:${difficulty}`,
      }));

      console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Bucket ${i + 1} done, got ${questions.length} questions`, {
        quizId,
        type,
        difficulty,
        received: questions.length,
        timestamp: new Date().toISOString(),
      });

      allQuestions = allQuestions.concat(questions);
    } catch (error) {
      console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Bucket ${i + 1} failed:`, {
        quizId,
        type,
        difficulty,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      // Continue with other buckets
    }
  }

  if (allQuestions.length === 0) {
    throw new Error("No questions could be generated. Please try again.");
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Saving ${allQuestions.length} questions to database`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  let createdCount = 0;
  let failedCount = 0;

  // Save each question with blind recheck
  for (let i = 0; i < allQuestions.length; i++) {
    const q = allQuestions[i];

    try {
      // Validate
      if (!q.type || !q.prompt) {
        failedCount++;
        continue;
      }

      // Blind recheck
      const recheck = await blindRecheck(q as unknown as GeneratedQuestion);

      const status: QuestionStatus = recheck.flagged
        ? QuestionStatus.FLAGGED_FOR_REVIEW
        : QuestionStatus.DRAFT;

      await createQuestion(quizId, teacherId, {
        type: q.type,
        content: q as unknown as Record<string, unknown>,
        status,
        generationInstruction: plan.customInstructions ?? null,
      });

      createdCount++;
    } catch (error) {
      failedCount++;
      console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Failed to save question ${i + 1}:`, {
        quizId,
        questionIndex: i,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  session.phase = "completed";
  updateSession(session);

  const summary = `Generated ${createdCount} question(s). ${failedCount > 0 ? `${failedCount} failed.` : ""}`;

  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_COMPLETE}] Done`, {
    quizId,
    created: createdCount,
    failed: failedCount,
    timestamp: new Date().toISOString(),
  });

  logger.info("qb.chat.generation.completed", {
    teacherId,
    quizId,
    created: createdCount,
    failed: failedCount,
  });

  return {
    response: summary,
    plan,
    readyToGenerate: false,
    createdQuestions: createdCount,
  };
}

// ---------------------------------------------------------------------------
// End session
// ---------------------------------------------------------------------------

export function endQBChatSession(teacherId: string, quizId: string): void {
  console.log("[QB Chat] Session ended", { teacherId, quizId });
  clearSession(teacherId, quizId);
}

// ---------------------------------------------------------------------------
// Get session state
// ---------------------------------------------------------------------------

export function getQBChatSessionState(
  teacherId: string,
  quizId: string
): QBChatResult | null {
  const session = getSession(teacherId, quizId);
  if (!session) return null;

  return {
    response: "",
    plan: session.plan,
    readyToGenerate: session.phase !== "generating" && session.plan !== null,
  };
}
