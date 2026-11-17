/**
 * Unified AI Client
 * Supports both OpenRouter and Gemini providers
 */

import { config } from "../config";
import { AIProviderError, AIResponseError } from "../utils/errors";
import { ALL_MODELS, type AIProvider } from "./available-models";

export type { AIProvider } from "./available-models";

const LOG_PREFIX = "[AI Client]";

// Gemini API constants
const GEMINI_API_URL = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";

// OpenRouter API constants
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

/**
 * Free OpenRouter models tried, in order, when the configured one fails.
 *
 * Every id is verified against the live OpenRouter catalog, and each one is
 * checked against the live API for the two failure modes that would make it
 * useless here:
 *
 * - `thinkingmachines/inkling-2-small:free` answers HTTP 403 "only
 *   available on agentic harnesses", so it can never serve this app and is
 *   deliberately excluded.
 * - `inclusionai/ling-3.2-flash:free` is first because OpenRouter routes it
 *   to a provider pool with its own shared-pool limit, so it keeps working
 *   when the account-wide `openrouter_free_tier_daily` gate rejects the
 *   other free models with HTTP 429.
 *
 * The list is deliberately limited to free models so a fallback never costs
 * money without the teacher asking for a paid model.
 */
const OPENROUTER_FALLBACK_MODELS = [
  "inclusionai/ling-3.2-flash:free",
  "particle-ai/particle-1:free",
  "nvidia/nemotron-3.5-lightning:free",
  "recursive/flint-v1.0:free",
  "liquid/lfm-3-1.7b:free",
];

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

/**
 * Models that are tried when the provider's primary model is unavailable.
 *
 * A model that is overloaded (503) or out of quota (429) does not stop the
 * provider from answering - another model on the same key usually can.
 */
export function getFallbackModels(provider: AIProvider): string[] {
  if (provider === "gemini") {
    return config.gemini.fallbackModels.filter(
      (model) => model !== config.gemini.model
    );
  }

  // OpenRouter: try the other free models before giving up on the
  // provider. A single free model can be temporarily unavailable - either
  // the account's daily free-tier gate rejected it (HTTP 429
  // "free-models-per-day"), or the provider behind it is down - while
  // other free models still answer. The gate is enforced per free-model
  // pool, so a fallback model can still succeed.
  return OPENROUTER_FALLBACK_MODELS.filter(
    (model) => model !== config.openrouter.defaultModel
  );
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
 *
 * A 429 (rate limit / quota) is not retried either: the limit will still be
 * in place a second later. Retrying it would waste the budget that the
 * fallback provider needs, so the client moves on to the next provider
 * straight away.
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status >= 500;
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
  const addCandidate = (provider: AIProvider, model: string) => {
    if (!model) return;
    if (candidates.some((c) => c.provider === provider && c.model === model)) {
      return;
    }
    candidates.push({ provider, model });
  };

  if (options.provider) {
    addCandidate(
      options.provider,
      options.model ?? getProviderSettings(options.provider).model
    );
  }
  for (const provider of getConfiguredProviders()) {
    const settings = getProviderSettings(provider);
    addCandidate(settings.provider, settings.model);

    // Same provider, another model. A model that is overloaded or out of
    // quota does not mean the provider cannot answer.
    for (const fallback of getFallbackModels(provider)) {
      addCandidate(provider, fallback);
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
  let sawInvalidResponse = false;
  let sawQuotaError = false;
  let sawOpenRouterFreeTierLimit = false;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
    const candidate = candidates[candidateIndex];

    // Every provider gets a share of the remaining budget. Without this a
    // slow primary provider (Gemini can take 30s+ when it is overloaded)
    // would eat the whole budget and the fallback provider would never get a
    // chance to answer. The primary gets the larger share; the remaining
    // candidates share what is left.
    const remainingBudget = deadline - Date.now();
    const isLastCandidate = candidateIndex === candidates.length - 1;
    const remainingCandidates = candidates.length - candidateIndex;

    let slice: number;
    if (isLastCandidate) {
      slice = remainingBudget;
    } else {
      const firstShare = Math.max(8_000, Math.floor(remainingBudget * 0.5));
      const othersShare = Math.max(
        8_000,
        Math.floor((remainingBudget - firstShare) / (remainingCandidates - 1))
      );
      slice = candidateIndex === 0 ? firstShare : othersShare;
    }

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
        if (error instanceof AIResponseError) {
          sawInvalidResponse = true;
        }

        const status =
          error instanceof ProviderHttpError ? error.status : undefined;
        const retryable =
          status === undefined ? true : isRetryableStatus(status);

        if (status === 429) {
          sawQuotaError = true;
        }

        // OpenRouter rejects free-model requests once the account's daily
        // free-tier quota is spent. No other provider or model can serve
        // the request at that point, so the caller gets a specific,
        // actionable message instead of a generic "try again later".
        if (
          candidate.provider === "openrouter" &&
          status === 429 &&
          error instanceof ProviderHttpError &&
          error.body.includes("free-models-per-day")
        ) {
          sawOpenRouterFreeTierLimit = true;
        }

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

  // A provider answered but with something we could not read - report that
  // specifically instead of claiming the whole service is down.
  if (sawInvalidResponse) {
    throw new AIResponseError();
  }

  // Every provider refused the request because its quota is used up. Saying
  // so is more useful than a generic "temporarily unavailable".
  if (sawQuotaError) {
    if (sawOpenRouterFreeTierLimit) {
      throw new AIProviderError(
        "Các mô hình AI miễn phí đã đạt giới hạn yêu cầu trong ngày. Hãy nạp thêm credit vào tài khoản OpenRouter để có giới hạn cao hơn, hoặc thử lại sau khi giới hạn được đặt lại."
      );
    }

    throw new AIProviderError(
      "Dịch vụ AI đã hết hạn mức lúc này. Vui lòng thử lại sau."
    );
  }

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
    throw new ProviderHttpError("openrouter", 401, "Chưa cấu hình API key cho OpenRouter");
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
    throw new ProviderHttpError("gemini", 401, "Chưa cấu hình API key cho Gemini");
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
 * Find the first balanced JSON value in a piece of text.
 *
 * Models regularly wrap their JSON in prose ("Here is the plan: {...}") or in
 * markdown fences, and free models sometimes truncate their output. A greedy
 * regex cannot cope with any of that: it spans from the first bracket to the
 * last one and happily returns half-written JSON, which then fails to parse
 * and surfaces as a generic server error. This scans for the first opening
 * bracket and walks forward, tracking string literals, until the matching
 * closing bracket is found.
 */
export function extractJSONValue(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    const opener = text[i];
    if (opener !== "{" && opener !== "[") continue;

    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j++) {
      const char = text[j];

      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === opener) depth++;
      else if (char === closer) {
        depth--;
        if (depth === 0) return text.slice(i, j + 1);
      }
    }
  }

  return null;
}

/**
 * Strip markdown code fences that surround a JSON payload.
 */
function stripCodeFences(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Parse AI response and extract JSON
 */
function parseAIResponse<T>(content: string): T {
  const trimmed = content.trim();
  const unfenced = stripCodeFences(content);

  // Candidate payloads, best first: the raw text, the text without code
  // fences, and the first balanced JSON value found in either of them.
  const candidates: string[] = [];
  const pushCandidate = (value: string | null) => {
    if (value && value.trim() && !candidates.includes(value.trim())) {
      candidates.push(value.trim());
    }
  };

  pushCandidate(trimmed);
  pushCandidate(unfenced);
  pushCandidate(extractJSONValue(unfenced));
  pushCandidate(extractJSONValue(trimmed));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T;
      console.log(`${LOG_PREFIX} [PARSE] JSON parsed successfully`, {
        candidateLength: candidate.length,
        timestamp: new Date().toISOString(),
      });
      return parsed;
    } catch (parseError) {
      console.warn(`${LOG_PREFIX} [PARSE] Candidate is not valid JSON`, {
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        candidateLength: candidate.length,
        candidatePreview: candidate.substring(0, 200),
        timestamp: new Date().toISOString(),
      });
    }
  }

  console.error(`${LOG_PREFIX} [PARSE] No JSON payload found in AI response`, {
    contentLength: content.length,
    contentPreview: content.substring(0, 300),
    timestamp: new Date().toISOString(),
  });

  // A typed error, so the client gets an actionable message and the retry
  // loop can still try another provider.
  throw new AIResponseError();
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
