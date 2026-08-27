import { config } from "../config";
import type { QuestionType } from "@prisma/client";
import {
  generateQuestionsPrompt,
  recheckQuestionPrompt,
  proposeLecturesPrompt,
  type GeneratedPrompt,
  type RecheckResult,
  type LectureProposal,
} from "./prompts";

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
  | CalculationContent;

export interface GenerationOptions {
  quizId: string;
  instructions: string;
  count: number;
  materialText?: string;
  questionTypes?: QuestionType[];
  difficulty?: "easy" | "medium" | "hard";
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  usedFallback: boolean;
  errors?: string[];
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiError {
  status: number;
  message: string;
}

async function callGeminiForJSON<T>(
  prompt: string,
  retries: number = 3,
  retryDelayMs: number = 1000
): Promise<T> {
  const { apiKey, model } = config.gemini;

  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();

      const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error("No text content in Gemini response");
      }

      let cleanedText = textContent.trim();

      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.slice(3);
      }

      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.slice(0, -3);
      }

      cleanedText = cleanedText.trim();

      try {
        return JSON.parse(cleanedText) as T;
      } catch (parseError) {
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as T;
        }
        throw new Error("Failed to parse JSON from Gemini response");
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Unknown error calling Gemini API");
}

function getQuestionTypeMix(count: number, preferredTypes?: QuestionType[]): QuestionType[] {
  const types: QuestionType[] = preferredTypes && preferredTypes.length > 0
    ? preferredTypes
    : ["MCQ", "MCQ", "SHORT_ANSWER", "CALCULATION"];

  const mix: QuestionType[] = [];

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

function validateAndTransformQuestion(raw: GeneratedPrompt): GeneratedQuestion {
  if (!raw.type) {
    throw new Error("Question missing 'type' field");
  }

  switch (raw.type) {
    case "MCQ": {
      if (!Array.isArray(raw.options) || raw.options.length !== 4) {
        throw new Error(`MCQ requires exactly 4 options, got ${raw.options?.length ?? 0}`);
      }
      if (typeof raw.correctOptionIndex !== "number" || raw.correctOptionIndex < 0 || raw.correctOptionIndex > 3) {
        throw new Error(`MCQ correctOptionIndex must be 0-3, got ${raw.correctOptionIndex}`);
      }
      return {
        type: "MCQ",
        prompt: String(raw.prompt),
        options: raw.options.map(String),
        correctOptionIndex: raw.correctOptionIndex,
        explanation: raw.explanation ? String(raw.explanation) : undefined,
      };
    }

    case "SHORT_ANSWER": {
      if (!raw.correctAnswer || typeof raw.correctAnswer !== "string") {
        throw new Error("SHORT_ANSWER missing valid 'correctAnswer'");
      }
      return {
        type: "SHORT_ANSWER",
        prompt: String(raw.prompt),
        correctAnswer: raw.correctAnswer,
        explanation: raw.explanation ? String(raw.explanation) : undefined,
      };
    }

    case "CALCULATION": {
      if (!raw.promptTemplate || !raw.answerFormula) {
        throw new Error("CALCULATION missing 'promptTemplate' or 'answerFormula'");
      }
      if (!Array.isArray(raw.variables) || raw.variables.length === 0) {
        throw new Error("CALCULATION requires at least one variable");
      }
      return {
        type: "CALCULATION",
        promptTemplate: String(raw.promptTemplate),
        variables: raw.variables.map((v) => ({
          name: String(v.name),
          min: Number(v.min),
          max: Number(v.max),
          decimals: v.decimals !== undefined ? Number(v.decimals) : undefined,
        })),
        answerFormula: String(raw.answerFormula),
        explanation: raw.explanation ? String(raw.explanation) : undefined,
      };
    }

    default:
      throw new Error(`Unknown question type: ${(raw as { type: string }).type}`);
  }
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
    result = result.replace(new RegExp(`\\{${v.name}\\}`, "g"), String(rounded));
  }

  return result;
}

export async function generateQuestions(
  options: GenerationOptions
): Promise<GenerationResult> {
  const { count, instructions, questionTypes, difficulty, materialText } = options;
  const errors: string[] = [];
  const questions: GeneratedQuestion[] = [];

  if (!isGeminiConfigured()) {
    return generateMockQuestions(count, questionTypes);
  }

  try {
    const types = getQuestionTypeMix(count, questionTypes);
    const typeList = [...new Set(types)];

    const prompt = generateQuestionsPrompt({
      topic: instructions,
      count,
      questionTypes: typeList,
      difficulty: difficulty ?? "medium",
      materialText,
    });

    const rawQuestions = await callGeminiForJSON<GeneratedPrompt[]>(prompt);

    if (!Array.isArray(rawQuestions)) {
      throw new Error("Gemini returned non-array response");
    }

    for (let i = 0; i < rawQuestions.length; i++) {
      try {
        const question = validateAndTransformQuestion(rawQuestions[i]);

        if (question.type === "CALCULATION") {
          const substitutedPrompt = substituteVariables(
            question.promptTemplate,
            question.variables
          );
          questions.push({
            ...question,
            promptTemplate: substitutedPrompt,
          });
        } else {
          questions.push(question);
        }
      } catch (validationError) {
        errors.push(`Question ${i + 1}: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
      }
    }

    return {
      questions,
      usedFallback: false,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    errors.push(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);

    if (questions.length === 0) {
      return generateMockQuestions(count, questionTypes);
    }

    return {
      questions,
      usedFallback: questions.length < count,
      errors,
    };
  }
}

function generateMockQuestions(count: number, preferredTypes?: QuestionType[]): GenerationResult {
  const questionTypes = getQuestionTypeMix(count, preferredTypes);
  const questions: GeneratedQuestion[] = questionTypes.map((type) => {
    let question: GeneratedQuestion;

    switch (type) {
      case "MCQ":
        question = {
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
        };
        break;

      case "SHORT_ANSWER":
        question = {
          type: "SHORT_ANSWER",
          prompt: "Define what a primary key is in a relational database.",
          correctAnswer:
            "A primary key is a column or set of columns that uniquely identifies each row in a table.",
          explanation:
            "A primary key must contain unique values and cannot contain NULL values.",
        };
        break;

      case "CALCULATION":
        question = {
          type: "CALCULATION",
          promptTemplate:
            "A database table has {num_records} records and {num_indexes} indexes. Each index adds {overhead_percent}% storage overhead per record. Calculate the total storage overhead in MB if each record is {record_size} bytes.",
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
        };

        const substitutedPrompt = substituteVariables(
          question.promptTemplate,
          question.variables
        );
        question = {
          ...question,
          promptTemplate: substitutedPrompt,
        };
        break;

      default:
        question = {
          type: "SHORT_ANSWER",
          prompt: "What is the default mock question?",
          correctAnswer: "Mock answer",
        };
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
    questionTypes: ["MCQ", "SHORT_ANSWER"],
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
  if (!isGeminiConfigured()) {
    if (Math.random() < 0.05) {
      return {
        flagged: true,
        reason: "Possible ambiguity detected in question phrasing.",
      };
    }
    return { flagged: false };
  }

  try {
    const prompt = recheckQuestionPrompt(question);
    const result = await callGeminiForJSON<RecheckResult>(prompt);

    return {
      flagged: result.flagged,
      reason: result.reason,
    };
  } catch {
    return { flagged: false };
  }
}

export async function proposeLectures(
  materialText: string
): Promise<Array<{ title: string; startPage: number; endPage: number }>> {
  if (!isGeminiConfigured()) {
    return generateMockLectures();
  }

  try {
    const prompt = proposeLecturesPrompt(materialText);
    const result = await callGeminiForJSON<Array<{ title: string; startPage: number; endPage: number }>>(prompt);
    return result;
  } catch (error) {
    console.error("Lecture proposal failed:", error);
    return generateMockLectures();
  }
}

function generateMockLectures(): Array<{ title: string; startPage: number; endPage: number }> {
  return [
    { title: "Introduction to Database Concepts", startPage: 1, endPage: 10 },
    { title: "Relational Data Modeling", startPage: 11, endPage: 25 },
    { title: "SQL Fundamentals", startPage: 26, endPage: 45 },
  ];
}

export function isGeminiConfigured(): boolean {
  try {
    return Boolean(config.gemini.apiKey);
  } catch {
    return false;
  }
}
