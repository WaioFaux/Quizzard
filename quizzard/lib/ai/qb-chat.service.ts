/**
 * Question Bank Chat Service
 * Handles the conversational workflow for generating quiz questions
 *
 * AI Processing Phases:
 * 1. Session Start - Return default config immediately (no blocking AI call)
 * 2. Generation - Call AI per type/difficulty bucket, blind recheck each question, save to DB
 * 
 * Supports both OpenRouter and Gemini providers
 */

import { prisma } from "../db";
import { NotFoundError, AuthorizationError, ValidationError } from "../utils/errors";
import { callAIForJSON, getAISettings, blindRecheck, type GeneratedQuestion } from "./ai-client";
import {
  QuestionProposal,
  GenerationPlan,
  TypeConfig,
  QuestionType,
  DifficultyLevel,
  getTypeDifficultyPrompt,
} from "./qb-chat-prompts";
import { createQuestion } from "../services/question-bank.service";
import { QuestionStatus, QuizStatus } from "@prisma/client";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[QB Chat Service]";

/**
 * Wall-clock budget for one generation request. The serverless function has
 * a hard limit (60s on Vercel Hobby), so the generation stops starting new
 * AI work once this is reached and returns what it has.
 */
const GENERATION_DEADLINE_MS = 30_000;
const LOG_PHASE = {
  SESSION_START: "SESSION_START",
  GENERATION_START: "GENERATION_START",
  AI_CALL: "AI_CALL",
  RECHECK: "RECHECK",
  DATABASE_SAVE: "DATABASE_SAVE",
  GENERATION_COMPLETE: "GENERATION_COMPLETE",
  ERROR: "ERROR",
} as const;

/**
 * Get AI settings for the request.
 */
function getAISettingsForRequest(headers?: Headers): {
  provider: "openrouter" | "gemini";
  model: string;
} {
  return getAISettings(headers);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Session ready`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  return {
    response:
      "Welcome to the Question Generator! Configure how many questions you want for each type and difficulty, then click **Generate** when ready.",
    plan: getDefaultGenerationPlan(),
    readyToGenerate: true,
  };
}

// ---------------------------------------------------------------------------
// Save a plan from the UI
// ---------------------------------------------------------------------------

export async function saveQBPlan(
  teacherId: string,
  quizId: string,
  plan: GenerationPlan
): Promise<QBChatResult> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { lecture: { select: { class: { select: { teacherId: true } } } } },
  });

  if (!quiz) {
    throw new NotFoundError("Quiz");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not have access to this quiz");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Cannot modify a published quiz");
  }

  return {
    response: "Settings saved. Click **Generate Questions** when ready.",
    plan,
    readyToGenerate: true,
  };
}

// ---------------------------------------------------------------------------
// Generate questions — loops over each type/difficulty bucket
// ---------------------------------------------------------------------------

export async function generateQuestions(
  teacherId: string,
  quizId: string,
  plan: GenerationPlan,
  headers?: Headers
): Promise<QBChatResult & { createdQuestions?: number }> {
  console.log(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Starting question generation`, {
    quizId,
    teacherId,
    timestamp: new Date().toISOString(),
  });

  // Get AI settings
  const aiSettings = getAISettingsForRequest(headers);

  if (!plan) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] No plan available for generation`);
    throw new ValidationError("No generation plan. Please configure settings first.");
  }

  // Fetch quiz (and the material for context)
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: {
        select: {
          class: { select: { teacherId: true } },
          material: { select: { extractedText: true } },
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Quiz");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("You do not have access to this quiz");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Cannot modify a published quiz");
  }

  const materialText = quiz.lecture.material?.extractedText ?? undefined;
  const topic = quiz.instructions;

  // Get enabled types from the plan
  const enabledTypes: QuestionType[] = [];
  const typeKeys: QuestionType[] = ["MCQ", "SHORT_ANSWER", "CALCULATION"];
  for (const t of typeKeys) {
    const config = plan[t];
    if (config && typeof config === "object" && "enabled" in config && config.enabled) {
      enabledTypes.push(t);
    }
  }

  if (enabledTypes.length === 0) {
    throw new ValidationError("No question types are enabled. Please enable at least one type.");
  }

  const difficulties: DifficultyLevel[] = ["easy", "medium", "hard"];

  // Collect all questions from all type/difficulty buckets
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

  // Generate the buckets concurrently. Running them one after another means
  // the total time is the sum of every AI call, which does not fit in the
  // serverless function budget once a plan has more than a few buckets.
  const BUCKET_CONCURRENCY = 3;
  const generationDeadline = Date.now() + GENERATION_DEADLINE_MS;
  const bucketResults: Array<(QuestionProposal & { _bucket: string })[]> = [];
  let nextBucket = 0;

  const bucketWorker = async () => {
    while (true) {
      const index = nextBucket++;
      if (index >= buckets.length) return;

      if (Date.now() >= generationDeadline) {
        console.warn(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Deadline reached, skipping remaining buckets`, {
          quizId,
          skipped: buckets.length - index,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { type, difficulty, count } = buckets[index];

      const budgetMs = generationDeadline - Date.now();
      if (budgetMs <= 0) {
        console.warn(`${LOG_PREFIX} [${LOG_PHASE.GENERATION_START}] Deadline reached, skipping remaining buckets`, {
          quizId,
          skipped: buckets.length - index,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Generating bucket ${index + 1}/${buckets.length}: ${count} ${difficulty} ${type}`, {
        quizId,
        type,
        difficulty,
        count,
        timestamp: new Date().toISOString(),
      });

      try {
        const prompt = getTypeDifficultyPrompt(
          topic,
          type,
          difficulty,
          count,
          plan.customInstructions,
          materialText
        );

        const response = await callAIForJSON<{ questions: QuestionProposal[] }>(
          prompt,
          { ...aiSettings, budgetMs }
        );

        const questions = (response.questions || []).map((q) => ({
          ...q,
          _bucket: `${type}:${difficulty}`,
        }));

        console.log(`${LOG_PREFIX} [${LOG_PHASE.AI_CALL}] Bucket ${index + 1} done, got ${questions.length} questions`, {
          quizId,
          type,
          difficulty,
          received: questions.length,
          timestamp: new Date().toISOString(),
        });

        bucketResults[index] = questions;
      } catch (error) {
        console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Bucket ${index + 1} failed:`, {
          quizId,
          type,
          difficulty,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        // Continue with other buckets
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(BUCKET_CONCURRENCY, buckets.length) },
      () => bucketWorker()
    )
  );

  const allQuestions = bucketResults.flatMap((questions) => questions ?? []);

  if (allQuestions.length === 0) {
    throw new ValidationError("No questions could be generated. Please try again.");
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Saving ${allQuestions.length} questions to database`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  // Blind recheck runs concurrently - it is one AI call per question and
  // running them one after another does not fit in the function budget.
  const RECHECK_CONCURRENCY = 5;
  const recheckResults = new Map<number, { flagged: boolean; reason?: string }>();
  let nextQuestion = 0;

  const recheckWorker = async () => {
    while (true) {
      const index = nextQuestion++;
      if (index >= allQuestions.length) return;

      const question = allQuestions[index];

      const budgetMs = generationDeadline - Date.now();
      if (budgetMs <= 0) {
        // Same outcome as a failed recheck: the question is saved as DRAFT
        // and the teacher reviews it before publishing.
        console.warn(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Recheck skipped, deadline reached`, {
          quizId,
          questionIndex: index,
          timestamp: new Date().toISOString(),
        });
        recheckResults.set(index, { flagged: false });
        continue;
      }

      try {
        const recheck = await blindRecheck(
          question as unknown as GeneratedQuestion,
          aiSettings.provider,
          aiSettings.model,
          budgetMs
        );
        recheckResults.set(index, recheck);
      } catch (error) {
        console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Recheck failed`, {
          quizId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        recheckResults.set(index, { flagged: false });
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(RECHECK_CONCURRENCY, allQuestions.length) },
      () => recheckWorker()
    )
  );

  let createdCount = 0;
  let failedCount = 0;

  // Save each question
  for (let i = 0; i < allQuestions.length; i++) {
    const q = allQuestions[i];

    try {
      // Validate
      if (!q.type || !q.prompt) {
        failedCount++;
        continue;
      }

      const recheck = recheckResults.get(i) ?? { flagged: false };

      const status: QuestionStatus = recheck.flagged
        ? QuestionStatus.FLAGGED_FOR_REVIEW
        : QuestionStatus.DRAFT;

      await createQuestion(quizId, teacherId, {
        type: q.type,
        content: q as unknown as Record<string, unknown>,
        status,
        generationInstruction: plan.customInstructions ?? undefined,
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
