/**
 * Unified AI Client
 * Supports both OpenRouter and Gemini providers
 */

import { config } from "../config";
import { AIProviderError } from "../utils/errors";
import { ALL_MODELS, type AIProvider } from "./available-models";

export type { AIProvider } from "./available-models";

const LOG_PREFIX = "[AI Client]";

// Gemini API constants
const GEMINI_API_URL = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";

// OpenRouter API constants
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

export interface AICallOptions {
  /** Preferred provider. When omitted the configured provider order is used. */
  provider?: AIProvider;
  /** Preferred model. When omitted the provider's configured model is used. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Upper bound for this call, including retries and the provider fallback.
   * Defaults to the configured total budget.
   */
  budgetMs?: number;
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
 * Get which providers are configured, in the order they should be tried.
 *
 * Gemini is the primary provider (model id comes from GEMINI_MODEL). The
 * Gemini API answers 503 "high demand" whenever it is overloaded, so the
 * other configured provider is kept as a fallback: when Gemini is busy the
 * request is served by the fallback instead of failing.
 */
export function getConfiguredProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  if (isProviderConfigured("gemini")) providers.push("gemini");
  if (isProviderConfigured("openrouter")) providers.push("openrouter");
  return providers;
}

/**
 * Model configured for a provider. Model ids always come from the
 * environment (OPENROUTER_DEFAULT_MODEL / GEMINI_MODEL) - never hardcoded.
 */
export function getProviderSettings(provider: AIProvider): {
  provider: AIProvider;
  model: string;
} {
  return provider === "openrouter"
    ? { provider, model: config.openrouter.defaultModel }
    : { provider, model: config.gemini.model };
}

/**
 * Resolve the AI settings for a request.
 *
 * A client may ask for a specific provider/model (the AI settings screen
 * stores the choice in the browser). The request is only honoured when the
 * model is one the app knows about, so a stale browser preference can never
 * point the app at a model id that does not exist.
 */
export function getAISettings(headers?: Headers): {
  provider: AIProvider;
  model: string;
} {
  const provider = headers?.get("x-ai-provider") as AIProvider | null;
  const model = headers?.get("x-ai-model");

  if (provider && model && (provider === "openrouter" || provider === "gemini")) {
    const known = ALL_MODELS.find(
      (m) => m.id === model && m.provider === provider
    );

    if (known) {
      return { provider, model };
    }

    console.warn(`${LOG_PREFIX} [AI_SETTINGS] Ignoring unknown model request`, {
      provider,
      model,
    });
  }

  const configuredProviders = getConfiguredProviders();

  if (configuredProviders.length === 0) {
    throw new AIProviderError(
      "No AI provider is configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in the environment."
    );
  }

  return getProviderSettings(configuredProviders[0]);
}

/** A provider answered with a non-2xx status. */
class ProviderHttpError extends Error {
  constructor(
    readonly provider: AIProvider,
    readonly status: number,
    readonly body: string
  ) {
    super(`${provider} API error ${status}`);
    this.name = "ProviderHttpError";
  }
}

/** The provider could not be reached at all (network fault or timeout). */
class ProviderNetworkError extends Error {
  constructor(
    readonly provider: AIProvider,
    readonly reason: string
  ) {
    super(`${provider} request failed: ${reason}`);
    this.name = "ProviderNetworkError";
  }
}

/**
 * Only transient failures are worth retrying. A 400/403/404 means the
 * request itself is wrong (bad model id, exhausted key quota), and retrying
 * it only burns the request budget.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Call an AI provider and parse the JSON response.
 *
 * Tries the preferred provider first and falls back to the other configured
 * provider when it fails, so a single flaky provider cannot take the whole
 * feature offline. Retries are limited to transient failures and to the
 * configured total time budget.
 */
export async function callAIForJSON<T>(
  prompt: string,
  options: AICallOptions = {},
  retries: number = 2,
  retryDelayMs: number = 1000
): Promise<T> {
  const { temperature = 0.7, maxTokens = 8192 } = options;

  // Build the ordered list of provider/model combinations to try.
  const candidates: Array<{ provider: AIProvider; model: string }> = [];
  if (options.provider) {
    candidates.push({
      provider: options.provider,
      model: options.model ?? getProviderSettings(options.provider).model,
    });
  }
  for (const provider of getConfiguredProviders()) {
    const settings = getProviderSettings(provider);
    if (
      !candidates.some(
        (c) => c.provider === settings.provider && c.model === settings.model
      )
    ) {
      candidates.push(settings);
    }
  }

  if (candidates.length === 0) {
    throw new AIProviderError(
      "No AI provider is configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY in the environment."
    );
  }

  console.log(`${LOG_PREFIX} [API_CALL_START] Initiating AI API call`, {
    providers: candidates.map((c) => `${c.provider}:${c.model}`),
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });

  const deadline =
    Date.now() +
    Math.min(config.ai.totalBudgetMs, options.budgetMs ?? config.ai.totalBudgetMs);
  const failures: string[] = [];

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    const candidate = candidates[candidateIndex];

    // Every provider gets a share of the remaining budget. Without this a
    // slow primary provider (Gemini can take 30s+ when it is overloaded)
    // would eat the whole budget and the fallback provider would never get a
    // chance to answer. The primary gets the larger share; the last provider
    // gets whatever is left.
    const remainingBudget = deadline - Date.now();
    const isLastCandidate = candidateIndex === candidates.length - 1;
    const slice = isLastCandidate
      ? remainingBudget
      : Math.max(10_000, Math.floor(remainingBudget * 0.6));
    const providerDeadline = Date.now() + slice;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const remaining = Math.min(providerDeadline, deadline) - Date.now();
      if (remaining <= 0) {
        console.warn(`${LOG_PREFIX} [API_BUDGET] Time budget exhausted`, {
          provider: candidate.provider,
          model: candidate.model,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      // Never let a single attempt outlive the remaining budget.
      const timeoutMs = Math.min(
        config.ai.requestTimeoutMs,
        Math.max(5000, remaining)
      );

      console.log(`${LOG_PREFIX} [API_ATTEMPT] Attempt ${attempt + 1}/${retries + 1}`, {
        provider: candidate.provider,
        model: candidate.model,
        attempt,
        timeoutMs,
        timestamp: new Date().toISOString(),
      });

      try {
        const result =
          candidate.provider === "openrouter"
            ? await callOpenRouter<T>(prompt, candidate.model, temperature, maxTokens, timeoutMs)
            : await callGemini<T>(prompt, candidate.model, temperature, maxTokens, timeoutMs);

        console.log(`${LOG_PREFIX} [API_SUCCESS] JSON parsed successfully`, {
          provider: candidate.provider,
          model: candidate.model,
          attempt,
          timestamp: new Date().toISOString(),
        });

        return result;
      } catch (error) {
        const status =
          error instanceof ProviderHttpError ? error.status : undefined;
        const retryable =
          status === undefined ? true : isRetryableStatus(status);

        failures.push(
          `${candidate.provider}:${status ?? "network"} ${truncate(
            describeProviderError(error),
            200
          )}`
        );

        console.error(`${LOG_PREFIX} [API_ERROR] Request failed on attempt ${attempt + 1}`, {
          provider: candidate.provider,
          model: candidate.model,
          attempt,
          status,
          retryable,
          error: describeProviderError(error),
          timestamp: new Date().toISOString(),
        });

        if (!retryable) {
          // The provider rejected the request itself - another provider with
          // a different model may still work.
          break;
        }

        if (attempt < retries) {
          const delay = retryDelayMs * Math.pow(2, attempt);
          // Do not spend the next provider's share of the budget on a retry.
          if (Date.now() + delay >= Math.min(providerDeadline, deadline)) break;
          console.log(`${LOG_PREFIX} [API_RETRY] Scheduling retry in ${delay}ms`, {
            provider: candidate.provider,
            model: candidate.model,
            attempt,
            nextAttempt: attempt + 1,
            delayMs: delay,
            timestamp: new Date().toISOString(),
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  console.error(`${LOG_PREFIX} [API_FATAL] All providers exhausted`, {
    failures,
    timestamp: new Date().toISOString(),
  });

  throw new AIProviderError();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

/**
 * Human readable description of a provider failure. Only used for
 * server-side logs - the client never sees the upstream response body.
 */
function describeProviderError(error: unknown): string {
  if (error instanceof ProviderHttpError) {
    return `${error.message}: ${truncate(error.body, 300)}`;
  }
  if (error instanceof ProviderNetworkError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter<T>(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  timeoutMs: number = config.ai.requestTimeoutMs
): Promise<T> {
  const apiKey = config.openrouter.apiKey;

  if (!apiKey) {
    throw new ProviderHttpError("openrouter", 401, "OpenRouter API key not configured");
  }

  console.log(`${LOG_PREFIX} [OPENROUTER_REQUEST] Sending request`, {
    model,
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });

  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
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
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ProviderNetworkError(
      "openrouter",
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ProviderHttpError("openrouter", response.status, errorText);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new ProviderHttpError("openrouter", response.status, "No content in OpenRouter response");
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
  maxTokens: number,
  timeoutMs: number = config.ai.requestTimeoutMs
): Promise<T> {
  const apiKey = config.gemini.apiKey;

  if (!apiKey) {
    throw new ProviderHttpError("gemini", 401, "Gemini API key not configured");
  }

  console.log(`${LOG_PREFIX} [GEMINI_REQUEST] Sending request`, {
    model,
    promptLength: prompt.length,
    timestamp: new Date().toISOString(),
  });

  const url = `${GEMINI_API_URL}/${GEMINI_API_VERSION}/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
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
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ProviderNetworkError(
      "gemini",
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ProviderHttpError("gemini", response.status, errorText);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new ProviderHttpError("gemini", response.status, "No content in Gemini response");
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
  provider?: AIProvider,
  model?: string,
  budgetMs?: number
): Promise<{ flagged: boolean; reason?: string }> {
  const LOG_PREFIX_LOCAL = "[Blind Recheck]";
  const settings = provider
    ? { provider, model: model ?? getProviderSettings(provider).model }
    : getAISettings();

  console.log(`${LOG_PREFIX_LOCAL} Starting recheck`, {
    questionType: question.type,
    provider: settings.provider,
    model: settings.model,
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
      { ...settings, budgetMs }
    );

    console.log(`${LOG_PREFIX_LOCAL} Recheck finished`, {
      flagged: result.flagged,
      provider: settings.provider,
      model: settings.model,
      timestamp: new Date().toISOString(),
    });

    return {
      flagged: result.flagged,
      reason: result.reason,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX_LOCAL} Recheck failed, defaulting to no flag`, {
      error: error instanceof Error ? error.message : String(error),
      provider: settings.provider,
      model: settings.model,
      timestamp: new Date().toISOString(),
    });
    return { flagged: false };
  }
}
