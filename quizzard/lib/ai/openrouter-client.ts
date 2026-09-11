/**
 * OpenRouter AI Client
 * Provides a compatible interface with the existing gemini-client for seamless migration
 */

import { OpenRouter } from "@openrouter/sdk";
import { config } from "../config";

const LOG_PREFIX = "[OpenRouter Client]";

export interface OpenRouterError {
  status: number;
  message: string;
}

/**
 * Create an OpenRouter client instance
 */
function createClient(): OpenRouter {
  return new OpenRouter({
    apiKey: config.openrouter.apiKey || "",
  });
}

/**
 * Check if OpenRouter is properly configured
 */
export function isOpenRouterConfigured(): boolean {
  return Boolean(config.openrouter.apiKey);
}

/**
 * Call OpenRouter API for JSON responses
 * Compatible interface with callGeminiForJSON
 */
export async function callOpenRouterForJSON<T>(
  prompt: string,
  model?: string,
  retries: number = 3,
  retryDelayMs: number = 1000
): Promise<T> {
  const client = createClient();
  const modelToUse = model || config.openrouter.defaultModel;

  console.log(`${LOG_PREFIX} [API_CALL_START] Initiating OpenRouter API call`, {
    model: modelToUse,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 200),
    timestamp: new Date().toISOString(),
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    console.log(`${LOG_PREFIX} [API_ATTEMPT] Attempt ${attempt + 1}/${retries + 1}`, {
      model: modelToUse,
      attempt,
      timestamp: new Date().toISOString(),
    });

    try {
      console.log(`${LOG_PREFIX} [API_REQUEST] Sending request to OpenRouter`, {
        model: modelToUse,
        attempt,
        timestamp: new Date().toISOString(),
      });

      const completion = await client.chat.send({
        chatRequest: {
          model: modelToUse,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          maxTokens: 8192,
        },
      });

      if (completion instanceof ReadableStream) {
        throw new Error("Unexpected streaming response, expected non-streaming");
      }

      // Handle content which can be string or ChatContentItems[]
      const content = completion.choices[0]?.message?.content;
      let responseContent: string;
      
      if (typeof content === "string") {
        responseContent = content;
      } else if (Array.isArray(content)) {
        // If it's an array, extract text from parts
        const textPart = content.find((item) => "text" in item);
        responseContent = textPart && "text" in textPart ? textPart.text : "";
      } else {
        responseContent = String(content);
      }

      if (!responseContent) {
        throw new Error("No content in OpenRouter response");
      }

      console.log(`${LOG_PREFIX} [API_RESPONSE] Received response from OpenRouter`, {
        model: modelToUse,
        attempt,
        contentLength: responseContent.length,
        timestamp: new Date().toISOString(),
      });

      let cleanedText = responseContent.trim();

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

      console.log(`${LOG_PREFIX} [API_RESPONSE] Cleaned response text`, {
        model: modelToUse,
        attempt,
        cleanedLength: cleanedText.length,
        cleanedPreview: cleanedText.substring(0, 200),
        timestamp: new Date().toISOString(),
      });

      // Try to parse as JSON
      try {
        const result = JSON.parse(cleanedText) as T;
        console.log(`${LOG_PREFIX} [API_SUCCESS] JSON parsed successfully`, {
          model: modelToUse,
          attempt,
          timestamp: new Date().toISOString(),
        });
        return result;
      } catch (parseError) {
        console.warn(`${LOG_PREFIX} [API_PARSE] Standard JSON parse failed, trying regex extraction`, {
          model: modelToUse,
          attempt,
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          timestamp: new Date().toISOString(),
        });

        // Try regex extraction for JSON arrays or objects
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log(`${LOG_PREFIX} [API_PARSE] Found JSON with regex, parsing`, {
            model: modelToUse,
            attempt,
            matchLength: jsonMatch[0].length,
            timestamp: new Date().toISOString(),
          });
          return JSON.parse(jsonMatch[0]) as T;
        }
        throw new Error("Failed to parse JSON from OpenRouter response");
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(`${LOG_PREFIX} [API_ERROR] Request failed on attempt ${attempt + 1}`, {
        model: modelToUse,
        attempt,
        error: lastError.message,
        stack: lastError.stack,
        timestamp: new Date().toISOString(),
      });

      if (attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        console.log(`${LOG_PREFIX} [API_RETRY] Scheduling retry in ${delay}ms`, {
          model: modelToUse,
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
    model: modelToUse,
    lastError: lastError?.message,
    timestamp: new Date().toISOString(),
  });
  throw lastError ?? new Error("Unknown error calling OpenRouter API");
}

/**
 * Get list of available free models from configuration
 */
export function getAvailableModels() {
  return config.openrouter.availableModels;
}

/**
 * Get the default model
 */
export function getDefaultModel(): string {
  return config.openrouter.defaultModel;
}
