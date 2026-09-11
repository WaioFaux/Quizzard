/**
 * AI Service Abstraction Layer
 * Provides a unified interface for AI operations with model selection support
 * 
 * Currently uses OpenRouter as the primary provider with mock fallback
 */

import { callOpenRouterForJSON, isOpenRouterConfigured } from "./openrouter-client";
import {
  type GeneratedQuestion,
  type GenerationOptions,
  type GenerationResult,
  generateMockQuestions,
  blindRecheck as mockBlindRecheck,
  proposeLectures as mockProposeLectures,
  type MCQContent,
  type ShortAnswerContent,
  type CalculationContent,
} from "./gemini-client";

const LOG_PREFIX = "[AI Service]";

export interface AIServiceOptions {
  model?: string;
}

/**
 * Main AI service that handles all AI operations
 */
export class AIService {
  private model: string;

  constructor(options: AIServiceOptions = {}) {
    this.model = options.model || "";
  }

  /**
   * Generate questions using AI
   */
  async generateQuestions(options: GenerationOptions): Promise<GenerationResult> {
    if (!isOpenRouterConfigured()) {
      console.log(`${LOG_PREFIX} OpenRouter not configured, using mock data`);
      return generateMockQuestions(options.count, options.questionTypes);
    }

    try {
      // Build prompt based on options
      const prompt = this.buildQuestionPrompt(options);
      
      // Use OpenRouter to generate questions
      const questions = await callOpenRouterForJSON<GeneratedQuestion[]>(
        prompt,
        this.model || undefined
      );

      return {
        questions: questions || [],
        usedFallback: false,
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Error generating questions:`, error);
      // Fallback to mock data on error
      return generateMockQuestions(options.count, options.questionTypes);
    }
  }

  /**
   * Blind recheck a question
   */
  async recheckQuestion(question: GeneratedQuestion): Promise<{ flagged: boolean; reason?: string }> {
    if (!isOpenRouterConfigured()) {
      console.log(`${LOG_PREFIX} OpenRouter not configured, using random fallback recheck`);
      if (Math.random() < 0.05) {
        return {
          flagged: true,
          reason: "Possible ambiguity detected in question phrasing.",
        };
      }
      return { flagged: false };
    }

    try {
      const recheckPrompt = this.buildRecheckPrompt(question);
      const result = await callOpenRouterForJSON<{ flagged: boolean; reason?: string }>(
        recheckPrompt,
        this.model || undefined
      );
      return result;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error rechecking question:`, error);
      return { flagged: false };
    }
  }

  /**
   * Propose lectures from material text
   */
  async proposeLectures(materialText: string): Promise<Array<{ title: string; startPage: number; endPage: number }>> {
    if (!isOpenRouterConfigured()) {
      console.log(`${LOG_PREFIX} OpenRouter not configured, using mock lectures`);
      return mockProposeLectures(materialText);
    }

    try {
      const prompt = this.buildLectureProposalPrompt(materialText);
      const result = await callOpenRouterForJSON<
        Array<{ title: string; startPage: number; endPage: number }>
      >(prompt, this.model || undefined);
      return result;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error proposing lectures:`, error);
      return mockProposeLectures(materialText);
    }
  }

  /**
   * Generic JSON call for chat responses
   */
  async callForJSON<T>(prompt: string): Promise<T> {
    if (!isOpenRouterConfigured()) {
      throw new Error("OpenRouter not configured");
    }

    return callOpenRouterForJSON<T>(prompt, this.model || undefined);
  }

  private buildQuestionPrompt(options: GenerationOptions): string {
    const { count, instructions, questionTypes, difficulty, materialText } = options;
    
    const typeList = questionTypes?.join(", ") || "MCQ, SHORT_ANSWER";
    const difficultyLevel = difficulty || "medium";

    let prompt = `You are a quiz question generator. Generate ${count} questions for the following topic: ${instructions}

Question types: ${typeList}
Difficulty: ${difficultyLevel}
`;

    if (materialText) {
      prompt += `\n\nReference material:\n${materialText.substring(0, 5000)}`;
    }

    prompt += `

Generate questions in JSON format with this structure:
- For MCQ: { "type": "MCQ", "prompt": "...", "options": ["A", "B", "C", "D"], "correctOptionIndex": 0, "explanation": "..." }
- For SHORT_ANSWER: { "type": "SHORT_ANSWER", "prompt": "...", "correctAnswer": "...", "explanation": "..." }
- For CALCULATION: { "type": "CALCULATION", "promptTemplate": "...", "variables": [{ "name": "...", "min": 1, "max": 10 }], "answerFormula": "..." }

Return an array of question objects.`;

    return prompt;
  }

  private buildRecheckPrompt(question: GeneratedQuestion): string {
    let questionText = "";

    if (question.type === "MCQ") {
      questionText = `MCQ: ${question.prompt}\nOptions: ${question.options.join(", ")}`;
    } else if (question.type === "SHORT_ANSWER") {
      questionText = `Short Answer: ${question.prompt}\nCorrect Answer: ${question.correctAnswer}`;
    } else if (question.type === "CALCULATION") {
      questionText = `Calculation: ${question.promptTemplate}`;
    }

    return `Review this question for potential issues:
${questionText}

Check for:
- Ambiguous wording
- Grammatical errors
- Incorrect or missing information
- Multiple valid answers (for MCQ)

Respond in JSON format: { "flagged": boolean, "reason": "explanation if flagged" }`;
  }

  private buildLectureProposalPrompt(materialText: string): string {
    return `Analyze the following educational material and suggest how to divide it into lectures.

Material:
${materialText.substring(0, 8000)}

Respond in JSON format as an array of lecture proposals:
[{ "title": "Lecture Title", "startPage": 1, "endPage": 10 }]

Create logical divisions based on topics and subtopics.`;
  }
}

// Default service instance without specific model
export const defaultAIService = new AIService();

/**
 * Create an AI service with a specific model
 */
export function createAIService(model?: string): AIService {
  return new AIService({ model });
}

/**
 * Check if any AI provider is available
 */
export function isAIConfigured(): boolean {
  return isOpenRouterConfigured();
}
