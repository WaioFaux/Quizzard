/**
 * AI provider/model preference shared by the settings screen and the AI
 * panels. The choice is stored in the browser and sent with every AI
 * request, so the model a teacher picked is the model that answers.
 */

export const PROVIDER_STORAGE_KEY = "quizzard-ai-provider";
export const MODEL_STORAGE_KEY = "quizzard-ai-model";

/**
 * Headers that tell the server which provider/model the user selected.
 * The server ignores unknown model ids and falls back to the configured
 * default, so a stale preference cannot break a request.
 */
export function getAIHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const provider = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
    const model = window.localStorage.getItem(MODEL_STORAGE_KEY);

    if (!provider || !model) {
      return {};
    }

    return {
      "x-ai-provider": provider,
      "x-ai-model": model,
    };
  } catch {
    // localStorage can be unavailable (private mode) - the server default
    // is used in that case.
    return {};
  }
}
