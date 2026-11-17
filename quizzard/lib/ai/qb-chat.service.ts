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
 *
 * One request generates ONE bucket of questions (a type + difficulty group
 * of at most MAX_QUESTIONS_PER_CALL questions). A model that has to write a
 * "hard" bucket can need 40s before it answers, so the budget covers that
 * comfortably.
 */
const GENERATION_DEADLINE_MS = parseInt(
  process.env.AI_GENERATION_BUDGET_MS ?? "50000",
  10
);

/**
 * How many questions one AI call may ask for.
 *
 * The model writes the whole JSON payload in a single answer, and the time
 * that takes grows with the number of questions. Measured on the paid
 * tier: calls for 2-3 questions answered in 8-23s, while the calls that
 * needed more than 37s produced nothing at all. Capping the call at 2
 * questions keeps every call inside the request budget; the client splits
 * a larger plan into several small calls.
 */
const MAX_QUESTIONS_PER_CALL = 2;

/**
 * Budget for the blind re-check phase. The re-check is a second AI call per
 * question and runs in its own request, so it gets a budget of its own.
 */
const RECHECK_DEADLINE_MS = parseInt(
  process.env.AI_RECHECK_BUDGET_MS ?? "20000",
  10
);
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
  /** Ids of the questions that were created - used by the re-check call. */
  createdQuestionIds?: string[];
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
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Unauthorized access attempt`, {
      teacherId,
      quizOwner: quiz.lecture.class.teacherId,
      quizId,
    });
    throw new AuthorizationError("Bạn không có quyền truy cập bài kiểm tra này");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    console.error(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Quiz is published, cannot modify:`, quizId);
    throw new AuthorizationError("Không thể chỉnh sửa bài kiểm tra đã xuất bản");
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.SESSION_START}] Session ready`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  return {
    response:
      "Chào mừng đến với Trình tạo câu hỏi! Hãy cấu hình số câu hỏi bạn muốn cho từng loại và độ khó, rồi nhấn **Tạo câu hỏi** khi sẵn sàng.",
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
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không có quyền truy cập bài kiểm tra này");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Không thể chỉnh sửa bài kiểm tra đã xuất bản");
  }

  return {
    response: "Đã lưu cài đặt. Nhấn **Tạo câu hỏi** khi bạn đã sẵn sàng.",
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
  headers?: Headers,
  options?: {
    /**
     * Generate only this bucket (a type + difficulty group). A full plan
     * needs several AI calls and does not fit in one serverless request,
     * so the client asks for one bucket per request.
     */
    bucket?: { type: QuestionType; difficulty: DifficultyLevel; count?: number };
    /**
     * Save the questions without running the blind re-check. The client
     * asks for the re-check in a follow-up request, which keeps the
     * generation call inside the serverless time limit.
     */
    deferRecheck?: boolean;
  }
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
    throw new ValidationError("Chưa có kế hoạch tạo câu hỏi. Vui lòng cấu hình cài đặt trước.");
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
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không có quyền truy cập bài kiểm tra này");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Không thể chỉnh sửa bài kiểm tra đã xuất bản");
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
    throw new ValidationError("Chưa bật loại câu hỏi nào. Vui lòng bật ít nhất một loại.");
  }

  const difficulties: DifficultyLevel[] = ["easy", "medium", "hard"];

  // Collect all questions from all type/difficulty buckets
  const buckets: Array<{ type: QuestionType; difficulty: DifficultyLevel; count: number }> = [];

  // Build the list of buckets we need to generate. Every bucket is split
  // into chunks of at most MAX_QUESTIONS_PER_CALL questions, so a single
  // AI call never has to write more than that many questions - the number
  // of questions is what decides how long the model takes to answer.
  for (const type of enabledTypes) {
    const typeConfig = plan[type as keyof GenerationPlan] as TypeConfig;
    for (const diff of difficulties) {
      const count = typeConfig.distribution[diff];
      for (let offset = 0; offset < count; offset += MAX_QUESTIONS_PER_CALL) {
        buckets.push({
          type,
          difficulty: diff,
          count: Math.min(MAX_QUESTIONS_PER_CALL, count - offset),
        });
      }
    }
  }

  // A request that targets one bucket only generates that bucket. The client
  // walks the buckets one by one, so every request stays inside the
  // serverless time limit.
  const targetBucket = options?.bucket;
  if (targetBucket) {
    const match = buckets.find(
      (b) => b.type === targetBucket.type && b.difficulty === targetBucket.difficulty
    );
    buckets.length = 0;
    if (match) {
      // The client may ask for fewer questions than the plan allocates to
      // this bucket. It never gets more than the plan allows, and never
      // more than one AI call can answer in time.
      const requested = targetBucket.count;
      const count = Math.min(
        requested ? requested : match.count,
        match.count,
        MAX_QUESTIONS_PER_CALL
      );
      buckets.push({ ...match, count });
    } else {
      throw new ValidationError(
        `Không có cấu hình cho ${targetBucket.type} mức ${targetBucket.difficulty}.`
      );
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
  //
  // When the request targets a single bucket (the normal path - the client
  // drives one bucket per request) there is nothing to parallelise.
  const BUCKET_CONCURRENCY = buckets.length > 1 ? 3 : 1;
  const generationDeadline = Date.now() + GENERATION_DEADLINE_MS;
  const recheckDeadline = generationDeadline + RECHECK_DEADLINE_MS;
  const bucketResults: Array<(QuestionProposal & { _bucket: string })[]> = [];
  let firstBucketError: unknown = null;
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

        // Keep the first failure so the caller learns why the bucket failed
        // instead of only seeing "no questions were created".
        if (!firstBucketError) {
          firstBucketError = error;
        }
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
    // Surface the real reason (quota exhausted, provider overloaded, ...)
    // instead of a generic message that hides it.
    if (firstBucketError) {
      throw firstBucketError;
    }

    throw new ValidationError("Không thể tạo câu hỏi nào. Vui lòng thử lại.");
  }

  console.log(`${LOG_PREFIX} [${LOG_PHASE.DATABASE_SAVE}] Saving ${allQuestions.length} questions to database`, {
    quizId,
    timestamp: new Date().toISOString(),
  });

  // Blind recheck runs concurrently - it is one AI call per question and
  // running them one after another does not fit in the function budget.
  //
  // When the re-check is deferred (the client asks for it in a follow-up
  // request) the questions are saved as DRAFT and re-checked afterwards.
  const deferRecheck = options?.deferRecheck === true;
  const recheckResults = new Map<number, { flagged: boolean; reason?: string }>();

  if (!deferRecheck) {
    const RECHECK_CONCURRENCY = 5;
    let nextQuestion = 0;

    const recheckWorker = async () => {
      while (true) {
        const index = nextQuestion++;
        if (index >= allQuestions.length) return;

        const question = allQuestions[index];

        const budgetMs = recheckDeadline - Date.now();
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
  }

  let createdCount = 0;
  let failedCount = 0;
  const createdQuestionIds: string[] = [];

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

      const saved = await createQuestion(quizId, teacherId, {
        type: q.type,
        content: q as unknown as Record<string, unknown>,
        status,
        generationInstruction: plan.customInstructions ?? undefined,
      });

      createdQuestionIds.push(saved.id);
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

  const summary = `Đã tạo ${createdCount} câu hỏi. ${failedCount > 0 ? `${failedCount} câu hỏi bị lỗi.` : ""}`;

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
    createdQuestionIds,
  };
}

/**
 * Blind re-check of questions that were already generated and saved.
 *
 * The re-check is a separate request because it is a second AI call per
 * question: running it inside the generation request left the generation
 * with less time than the model needed, and the generation was aborted.
 */
export async function recheckQuestions(
  teacherId: string,
  quizId: string,
  questionIds: string[],
  headers?: Headers
): Promise<{ checked: number; flagged: number }> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { lecture: { select: { class: { select: { teacherId: true } } } } },
  });

  if (!quiz) {
    throw new NotFoundError("Bài kiểm tra");
  }

  if (quiz.lecture.class.teacherId !== teacherId) {
    throw new AuthorizationError("Bạn không có quyền truy cập bài kiểm tra này");
  }

  if (quiz.status === QuizStatus.PUBLISHED) {
    throw new AuthorizationError("Không thể chỉnh sửa bài kiểm tra đã xuất bản");
  }

  if (questionIds.length === 0) {
    return { checked: 0, flagged: 0 };
  }

  const items = await prisma.questionBankItem.findMany({
    where: { id: { in: questionIds }, quizId },
  });

  if (items.length === 0) {
    return { checked: 0, flagged: 0 };
  }

  const aiSettings = getAISettingsForRequest(headers);
  const deadline = Date.now() + RECHECK_DEADLINE_MS;
  const results = new Map<string, { flagged: boolean; reason?: string }>();
  let nextItem = 0;

  const worker = async () => {
    while (true) {
      const index = nextItem++;
      if (index >= items.length) return;

      const item = items[index];
      const budgetMs = deadline - Date.now();

      if (budgetMs <= 0) {
        results.set(item.id, { flagged: false });
        continue;
      }

      try {
        const recheck = await blindRecheck(
          item.content as unknown as GeneratedQuestion,
          aiSettings.provider,
          aiSettings.model,
          budgetMs
        );
        results.set(item.id, recheck);
      } catch (error) {
        console.error(`${LOG_PREFIX} [${LOG_PHASE.ERROR}] Recheck failed`, {
          quizId,
          questionId: item.id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        results.set(item.id, { flagged: false });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(5, items.length) }, () => worker())
  );

  let flagged = 0;

  for (const [questionId, recheck] of results) {
    if (!recheck.flagged) {
      continue;
    }

    flagged++;

    // DRAFT -> FLAGGED_FOR_REVIEW is a legal transition.
    await prisma.questionBankItem.update({
      where: { id: questionId },
      data: {
        status: QuestionStatus.FLAGGED_FOR_REVIEW,
        reviewNote: recheck.reason ?? null,
      },
    });
  }

  return { checked: results.size, flagged };
}
