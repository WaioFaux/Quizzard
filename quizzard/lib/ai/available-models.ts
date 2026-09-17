/**
 * Available AI Models Configuration
 * Client-safe configuration that doesn't depend on server environment variables
 */

export type AIProvider = "openrouter" | "gemini";

export interface ModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  contextLength: number;
  price?: { prompt: number; completion: number }; // per 1M tokens
  isFree?: boolean;
}

// ============================================
// OPENROUTER MODELS
// ============================================

// Free models from OpenRouter
const FREE_MODELS: ModelOption[] = [
  {
    id: "inclusionai/ling-3.0-flash-vl:free",
    name: "Ling 3.0 Flash VL",
    provider: "openrouter",
    description: "Fast with vision support. Good all-rounder for text and image tasks.",
    contextLength: 262144,
    isFree: true,
  },
  {
    id: "nex-agi/nex-n2.5-mini:free",
    name: "Nex-N2.5-Mini",
    provider: "openrouter",
    description: "Lightweight agentic model. Good for coding and text tasks.",
    contextLength: 262144,
    isFree: true,
  },
  {
    id: "nex-agi/nex-n2.5-pro:free",
    name: "Nex-N2.5-Pro",
    provider: "openrouter",
    description: "Higher quality agentic model. Better reasoning and analysis.",
    contextLength: 262144,
    isFree: true,
  },
  {
    id: "inclusionai/ling-3.0-flash-sante:free",
    name: "Ling 3.0 Flash Sante",
    provider: "openrouter",
    description: "Health and medicine-focused model. Specialized for medical content.",
    contextLength: 262144,
    isFree: true,
  },
  {
    id: "qwen/qwen3.0-7b-instruct:free",
    name: "Qwen 3.0 7B Instruct",
    provider: "openrouter",
    description: "Open-source model with strong multilingual capabilities.",
    contextLength: 32768,
    isFree: true,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct",
    provider: "openrouter",
    description: "Large open model from Meta. Excellent reasoning.",
    contextLength: 128000,
    isFree: true,
  },
];

// Affordable paid models from OpenRouter
const OPENROUTER_AFFORDABLE: ModelOption[] = [
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "openrouter",
    description: "Excellent value. Large 1M context, strong reasoning.",
    contextLength: 1048576,
    price: { prompt: 0.15, completion: 0.6 },
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "openrouter",
    description: "Fast Google model with large context window.",
    contextLength: 1048576,
    price: { prompt: 0.75, completion: 3.75 },
  },
  {
    id: "qwen/qwen3.8-max-0902",
    name: "Qwen3.8 Max",
    provider: "openrouter",
    description: "Top-tier open model from Alibaba. Excellent reasoning.",
    contextLength: 1000000,
    price: { prompt: 2, completion: 6 },
  },
  {
    id: "meta/muse-spark-1.3",
    name: "Meta Muse Spark 1.3",
    provider: "openrouter",
    description: "Multimodal reasoning from Meta. Great for complex tasks.",
    contextLength: 1048576,
    price: { prompt: 1.25, completion: 4.25 },
  },
  {
    id: "anthropic/sonnet-4.2-mini",
    name: "Claude Sonnet 4.2 Mini",
    provider: "openrouter",
    description: "Anthropic's efficient model. Good balance of speed and quality.",
    contextLength: 200000,
    price: { prompt: 0.8, completion: 4 },
  },
  {
    id: "anthropic/sonnet-4.2",
    name: "Claude Sonnet 4.2",
    provider: "openrouter",
    description: "Anthropic's standard model. Strong analysis and reasoning.",
    contextLength: 200000,
    price: { prompt: 3, completion: 15 },
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openrouter",
    description: "Fast and affordable GPT-4.1 variant.",
    contextLength: 128000,
    price: { prompt: 0.1, completion: 0.4 },
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openrouter",
    description: "Mid-tier GPT-4.1 model with good capabilities.",
    contextLength: 128000,
    price: { prompt: 0.3, completion: 1.2 },
  },
];

// Premium models from OpenRouter
const OPENROUTER_PREMIUM: ModelOption[] = [
  {
    id: "openai/gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "openrouter",
    description: "OpenAI flagship model. Best for complex reasoning and analysis.",
    contextLength: 1050000,
    price: { prompt: 10, completion: 50 },
  },
  {
    id: "~openai/gpt-sol-latest",
    name: "GPT Sol Latest",
    provider: "openrouter",
    description: "Latest GPT Sol family. Great value for quality.",
    contextLength: 1050000,
    price: { prompt: 2, completion: 10 },
  },
  {
    id: "~openai/gpt-astra-latest",
    name: "GPT Astra Latest",
    provider: "openrouter",
    description: "Latest GPT Astra family. Updated with newest capabilities.",
    contextLength: 1050000,
    price: { prompt: 10, completion: 50 },
  },
  {
    id: "anthropic/claude-opus-4.2",
    name: "Claude Opus 4.2",
    provider: "openrouter",
    description: "Anthropic's most capable model. Excellent for complex reasoning.",
    contextLength: 200000,
    price: { prompt: 15, completion: 75 },
  },
  {
    id: "google/gemini-3.8-pro",
    name: "Gemini 3.8 Pro",
    provider: "openrouter",
    description: "Google's most capable model. Strong reasoning and analysis.",
    contextLength: 1048576,
    price: { prompt: 3.5, completion: 14 },
  },
];

// ============================================
// GEMINI MODELS (Direct API)
// ============================================

const GEMINI_MODELS: ModelOption[] = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "gemini",
    description: "Latest Gemini model. Fast with excellent reasoning capabilities.",
    contextLength: 1048576,
  },
  {
    id: "gemini-3.6-flash-exp",
    name: "Gemini 3.6 Flash Experimental",
    provider: "gemini",
    description: "Experimental version with latest features.",
    contextLength: 1048576,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "gemini",
    description: "Enhanced capabilities with improved reasoning.",
    contextLength: 1048576,
  },
  {
    id: "gemini-3.0-flash",
    name: "Gemini 3.0 Flash",
    provider: "gemini",
    description: "Latest fast model with best-in-class performance.",
    contextLength: 1048576,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "Reliable fast model with strong performance.",
    contextLength: 1048576,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    description: "Fast and capable. Great for most tasks.",
    contextLength: 1048576,
  },
  {
    id: "gemini-3.6-pro",
    name: "Gemini 3.6 Pro",
    provider: "gemini",
    description: "Most capable Gemini model for complex tasks.",
    contextLength: 1048576,
  },
  {
    id: "gemini-3.5-pro",
    name: "Gemini 3.5 Pro",
    provider: "gemini",
    description: "Enhanced Gemini model with improved reasoning.",
    contextLength: 1048576,
  },
];

// ============================================
// EXPORTS
// ============================================

export const OPENROUTER_MODELS = [...FREE_MODELS, ...OPENROUTER_AFFORDABLE, ...OPENROUTER_PREMIUM];
export const ALL_MODELS = [...OPENROUTER_MODELS, ...GEMINI_MODELS];

// Default model - use Gemini 3.6 Flash as the default
export const DEFAULT_MODEL = "gemini-3.6-flash";
export const DEFAULT_PROVIDER = "gemini" as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getModelsByProvider(provider: AIProvider): ModelOption[] {
  return ALL_MODELS.filter((m) => m.provider === provider);
}

export function getModelById(id: string): ModelOption | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

export function formatContextLength(length: number): string {
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(0)}M tokens`;
  }
  return `${(length / 1024).toFixed(0)}K tokens`;
}

export function formatPrice(price?: { prompt: number; completion: number }): string {
  if (!price) return "Free";
  return `$${price.prompt}/${price.completion} per 1M tokens`;
}
