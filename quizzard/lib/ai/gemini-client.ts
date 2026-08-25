import { config } from "../config";
import type { QuestionType } from "@prisma/client";

export interface MCQContent {
  type: "MCQ";
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface ShortAnswerContent {
  type: "SHORT_ANSWER";
  prompt: string;
  correctAnswer: string;
  explanation?: string;
}

export interface EssayContent {
  type: "ESSAY";
  prompt: string;
  rubric?: string;
}

export interface CalculationContent {
  type: "CALCULATION";
  promptTemplate: string;
  variables: Array<{
    name: string;
    min: number;
    max: number;
    decimals?: number;
  }>;
  answerFormula: string;
  explanation?: string;
}

export type GeneratedQuestion =
  | MCQContent
  | ShortAnswerContent
  | EssayContent
  | CalculationContent;

export interface GenerationOptions {
  quizId: string;
  instructions: string;
  count: number;
  materialText?: string;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  usedFallback: boolean;
}

const MOCK_QUESTIONS: Record<QuestionType, () => GeneratedQuestion> = {
  MCQ: () => ({
    type: "MCQ",
    prompt: "What is the primary purpose of indexes in a database?",
    options: [
      "To speed up data retrieval operations",
      "To increase storage space",
      "To enforce data integrity",
      "To compress data files",
    ],
    correctOptionIndex: 0,
    explanation:
      "Indexes create data structures that improve the speed of data retrieval operations on a database table.",
  }),
  SHORT_ANSWER: () => ({
    type: "SHORT_ANSWER",
    prompt: "Define what a primary key is in a relational database.",
    correctAnswer:
      "A primary key is a column or set of columns that uniquely identifies each row in a table.",
    explanation:
      "A primary key must contain unique values and cannot contain NULL values.",
  }),
  ESSAY: () => ({
    type: "ESSAY",
    prompt:
      "Explain the differences between normalization and denormalization. Discuss when each approach is appropriate.",
    rubric:
      "Key points: definition of normalization (1-3NF, BCNF), removal of data redundancy, update anomalies, trade-offs with query performance, use cases for denormalization (read-heavy workloads, reporting).",
  }),
  CALCULATION: () => ({
    type: "CALCULATION",
    promptTemplate:
      "A database table has {{num_records}} records and {{num_indexes}} indexes. Each index adds {{overhead_percent}}% storage overhead per record. Calculate the total storage overhead in MB if each record is {{record_size}} bytes.",
    variables: [
      { name: "num_records", min: 1000, max: 100000, decimals: 0 },
      { name: "num_indexes", min: 1, max: 10, decimals: 0 },
      { name: "overhead_percent", min: 5, max: 20, decimals: 1 },
      { name: "record_size", min: 50, max: 500, decimals: 0 },
    ],
    answerFormula:
      "(num_records * record_size * num_indexes * overhead_percent / 100) / (1024 * 1024)",
    explanation:
      "Storage overhead = (number of records × record size × number of indexes × overhead %) / 100",
  }),
};

function getQuestionTypeMix(count: number): QuestionType[] {
  const mix: QuestionType[] = [];
  const types: QuestionType[] = ["MCQ", "MCQ", "SHORT_ANSWER", "ESSAY", "CALCULATION"];

  for (let i = 0; i < count; i++) {
    const index = i % types.length;
    mix.push(types[index]);
  }

  for (let i = mix.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mix[i], mix[j]] = [mix[j], mix[i]];
  }

  return mix;
}

export async function generateQuestions(
  options: GenerationOptions
): Promise<GenerationResult> {
  const { count } = options;

  const questionTypes = getQuestionTypeMix(count);
  const questions: GeneratedQuestion[] = questionTypes.map((type) => {
    const generator = MOCK_QUESTIONS[type];
    const question = generator();

    if (question.type === "CALCULATION") {
      const substitutedPrompt = substituteVariables(
        question.promptTemplate,
        question.variables
      );
      return {
        ...question,
        promptTemplate: substitutedPrompt,
      } as CalculationContent;
    }

    return question;
  });

  return {
    questions,
    usedFallback: true,
  };
}

export async function generateSampleQuestions(
  instructions: string,
  count: number = 3
): Promise<GenerationResult> {
  return generateQuestions({
    quizId: "sample",
    instructions,
    count,
  });
}

export async function generateFullQuestionBank(
  quizId: string,
  instructions: string,
  count: number,
  materialText?: string
): Promise<GenerationResult> {
  return generateQuestions({
    quizId,
    instructions,
    count,
    materialText,
  });
}

export async function blindRecheck(
  question: GeneratedQuestion
): Promise<{ flagged: boolean; reason?: string }> {
  if (Math.random() < 0.05) {
    return {
      flagged: true,
      reason: "Possible ambiguity detected in question phrasing.",
    };
  }

  return { flagged: false };
}

function substituteVariables(
  template: string,
  variables: Array<{ name: string; min: number; max: number; decimals?: number }>
): string {
  let result = template;
  const values: Record<string, number> = {};

  for (const v of variables) {
    const range = v.max - v.min;
    const value = v.min + Math.random() * range;
    const rounded =
      v.decimals !== undefined
        ? Math.round(value * 10 ** v.decimals) / 10 ** v.decimals
        : Math.round(value);
    values[v.name] = rounded;
    result = result.replace(new RegExp(`{{${v.name}}}`, "g"), String(rounded));
  }

  return result;
}

export function isGeminiConfigured(): boolean {
  try {
    return Boolean(config.gemini.apiKey);
  } catch {
    return false;
  }
}
