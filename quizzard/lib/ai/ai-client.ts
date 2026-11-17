/**
 * Unified AI Client
 * Supports both OpenRouter and Gemini providers
 */

import { config } from "../config";
import type { AIProvider } from "./available-models";

export type { AIProvider } from "./available-models";

const LOG_PREFIX = "[AI Client]";

// Gemini API constants
const GEMINI_API_URL = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";

// OpenRouter API constants
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

export interface AICallOptions {
  provider: AIProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(provider: AIProvider): boolean {
  if (provider === "openrouter") {
    return Boolean(config.openrouter.apiKey);
  } else {
    return Boolean(config.gemini.apiKey);
  }
}

/**
 * Get which providers are configured
 */
export function getConfiguredProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  if (isProviderConfigured("gemini")) providers.push("gemini");
  if (isProviderConfigured("openrouter")) providers.push("openrouter");
  return providers;
}

/**
 * Call AI provider for JSON response
 */
export async function callAIForJSON<T>(
  prompt: string,
  options: AICallOptions,
  retries: number = 3,
  retryDelayMs: number = 1000
): Promise<T> {
  const { provider, model, temperature = 0.7, maxTokens = 8192 } = options;

  console.log(`${LOG_PREFIX} [API_CALL_START] Initiating AI API call`, {
    provider,
    model,
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    console.log(`${LOG_PREFIX} [API_ATTEMPT] Attempt ${attempt + 1}/${retries + 1}`, {
      provider,
      model,
      attempt,
      timestamp: new Date().toISOString(),
    });

    try {
      let result: T;

      if (provider === "openrouter") {
        result = await callOpenRouter<T>(prompt, model, temperature, maxTokens);
      } else {
        result = await callGemini<T>(prompt, model, temperature, maxTokens);
      }

      console.log(`${LOG_PREFIX} [API_SUCCESS] JSON parsed successfully`, {
        provider,
        model,
        attempt,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(`${LOG_PREFIX} [API_ERROR] Request failed on attempt ${attempt + 1}`, {
        provider,
        model,
        attempt,
        error: lastError.message,
        timestamp: new Date().toISOString(),
      });

      if (attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        console.log(`${LOG_PREFIX} [API_RETRY] Scheduling retry in ${delay}ms`, {
          provider,
          model,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: delay,
          timestamp: new Date().toISOString(),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`${LOG_PREFIX} [API_FATAL] All ${retries + 1} retry attempts exhausted`, {
    provider,
    model,
    lastError: lastError?.message,
    timestamp: new Date().toISOString(),
  });

  throw lastError ?? new Error("Unknown error calling AI API");
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter<T>(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<T> {
  const apiKey = config.openrouter.apiKey;

  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY in your environment.");
  }

  console.log(`${LOG_PREFIX} [OPENROUTER_REQUEST] Sending request`, {
    model,
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
    // Abort a provider that stops responding so the retry loop can take over
    // instead of the request hanging until the function is killed.
    signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenRouter response");
  }

  return parseAIResponse<T>(content);
}

/**
 * Call Gemini API
 */
async function callGemini<T>(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number
): Promise<T> {
  const apiKey = config.gemini.apiKey;

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in your environment.");
  }

  console.log(`${LOG_PREFIX} [GEMINI_REQUEST] Sending request`, {
    model,
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });

  const url = `${GEMINI_API_URL}/${GEMINI_API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      },
    }),
    // Abort a provider that stops responding so the retry loop can take over
    // instead of the request hanging until the function is killed.
    signal: AbortSignal.timeout(config.ai.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error("No content in Gemini response");
  }

  return parseAIResponse<T>(content);
}

/**
 * Parse AI response and extract JSON
 */
function parseAIResponse<T>(content: string): T {
  let cleanedText = content.trim();

  // Remove markdown code blocks if present
  if (cleanedText.startsWith("```json")) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.slice(3);
  }

  if (cleanedText.endsWith("```")) {
    cleanedText = cleanedText.slice(0, -3);
  }

  cleanedText = cleanedText.trim();

  console.log(`${LOG_PREFIX} [PARSE] Cleaned response text`, {
    cleanedLength: cleanedText.length,
    cleanedPreview: cleanedText.substring(0, 200),
    timestamp: new Date().toISOString(),
  });

  // Try to parse as JSON
  try {
    return JSON.parse(cleanedText) as T;
  } catch (parseError) {
    console.warn(`${LOG_PREFIX} [PARSE] Standard JSON parse failed, trying regex extraction`, {
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      timestamp: new Date().toISOString(),
    });

    // Try regex extraction for JSON arrays or objects
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error("Failed to parse JSON from AI response");
  }
}

// ---------------------------------------------------------------------------
// Question recheck
// ---------------------------------------------------------------------------

export interface GeneratedQuestion {
  type: string;
  prompt?: string;
  promptTemplate?: string;
  options?: string[];
  correctAnswer?: string;
}

/**
 * Blind recheck a question using AI
 */
export async function blindRecheck(
  question: GeneratedQuestion,
  provider: AIProvider,
  model: string
): Promise<{ flagged: boolean; reason?: string }> {
  const LOG_PREFIX_LOCAL = "[Blind Recheck]";

  console.log(`${LOG_PREFIX_LOCAL} Starting recheck`, {
    questionType: question.type,
    provider,
    model,
    timestamp: new Date().toISOString(),
  });

  // Build question text
  let questionText = "";
  if (question.type === "MCQ") {
    questionText = `MCQ: ${question.prompt}\nOptions: ${question.options?.join(", ")}`;
  } else if (question.type === "SHORT_ANSWER") {
    questionText = `Short Answer: ${question.prompt}\nCorrect Answer: ${question.correctAnswer}`;
  } else if (question.type === "CALCULATION") {
    questionText = `Calculation: ${question.promptTemplate}`;
  }

  const prompt = `Review this question for potential issues:
${questionText}

Check for:
- Ambiguous wording
- Grammatical errors
- Incorrect or missing information
- Multiple valid answers (for MCQ)

Respond in JSON format: { "flagged": boolean, "reason": "explanation if flagged" }`;

  try {
    const result = await callAIForJSON<{ flagged: boolean; reason?: string }>(
      prompt,
      { provider, model }
    );

    console.log(`${LOG_PREFIX_LOCAL} Recheck finished`, {
      flagged: result.flagged,
      provider,
      model,
      timestamp: new Date().toISOString(),
    });

    return {
      flagged: result.flagged,
      reason: result.reason,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX_LOCAL} Recheck failed, defaulting to no flag`, {
      error: error instanceof Error ? error.message : String(error),
      provider,
      model,
      timestamp: new Date().toISOString(),
    });
    return { flagged: false };
  }
}
