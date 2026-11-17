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
//
// Every id below is verified against the live OpenRouter catalog
// (GET https://openrouter.ai/api/v1/models). OpenRouter rejects an
// unknown id with HTTP 400 "is not a valid model ID" before it reaches
// any provider, so a stale id here is a request that can never succeed.
//
// Note the free tier is capped at 50 requests/day per account (1000 once
// the account holds $10 of credits). That gate is enforced per OpenRouter
// free-model pool: when it rejects a model with HTTP 429
// "free-models-per-day", other free models may still be served, so the
// client tries a fallback list before giving up on the provider.
const FREE_MODELS: ModelOption[] = [
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    name: "ERNIE 5.5 Flash Preview",
    provider: "openrouter",
    description: "Nhanh và ổn định. Lựa chọn mặc định tốt cho việc tạo câu hỏi có cấu trúc.",
    contextLength: 1024000,
    isFree: true,
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Flint v1.0",
    provider: "openrouter",
    description: "Mô hình mở nhẹ, trả lời nhanh.",
    contextLength: 262144,
    isFree: true,
  },
  {
    id: "particle-ai/particle-1:free",
    name: "Particle 1",
    provider: "openrouter",
    description: "Mô hình mở đa năng, tốc độ nhanh.",
    contextLength: 1048576,
    isFree: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    provider: "openrouter",
    description: "Mô hình mở của NVIDIA với khả năng suy luận mạnh, ở mức giá của bậc miễn phí.",
    contextLength: 1000000,
    isFree: true,
  },
  {
    id: "inclusionai/ling-3.2-flash:free",
    name: "Ling 3.2 Flash",
    provider: "openrouter",
    description: "Mô hình đa ngôn ngữ miễn phí với cửa sổ ngữ cảnh rất lớn.",
    contextLength: 1048576,
    isFree: true,
  },
  {
    id: "liquid/lfm-3-1.7b:free",
    name: "LFM 3 1.7B",
    provider: "openrouter",
    description: "Mô hình miễn phí rất nhỏ. Nhanh nhưng chỉ phù hợp với câu hỏi đơn giản.",
    contextLength: 262144,
    isFree: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B IT",
    provider: "openrouter",
    description: "Mô hình mở miễn phí của Google được tinh chỉnh theo chỉ dẫn.",
    contextLength: 262144,
    isFree: true,
  },
];

// Affordable paid models from OpenRouter
const OPENROUTER_AFFORDABLE: ModelOption[] = [
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "openrouter",
    description: "Rất đáng giá. Ngữ cảnh 1M lớn, suy luận mạnh.",
    contextLength: 1048576,
    price: { prompt: 0.0507, completion: 0.2028 },
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "openrouter",
    description: "Mô hình Google nhanh với cửa sổ ngữ cảnh lớn.",
    contextLength: 1048576,
    price: { prompt: 0.825, completion: 4.125 },
  },
  {
    id: "qwen/qwen3.8-max-0902",
    name: "Qwen3.8 Max",
    provider: "openrouter",
    description: "Mô hình mở hàng đầu của Alibaba. Suy luận xuất sắc.",
    contextLength: 1000000,
    price: { prompt: 2, completion: 6 },
  },
  {
    id: "meta/muse-spark-1.3",
    name: "Meta Muse Spark 1.3",
    provider: "openrouter",
    description: "Suy luận đa phương thức của Meta. Rất phù hợp với các bài toán phức tạp.",
    contextLength: 1048576,
    price: { prompt: 1.25, completion: 4.25 },
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "openrouter",
    description: "Mô hình hiệu quả của Anthropic. Cân bằng tốt giữa tốc độ và chất lượng.",
    contextLength: 200000,
    price: { prompt: 1, completion: 5 },
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "openrouter",
    description: "Mô hình tiêu chuẩn của Anthropic. Phân tích và suy luận mạnh.",
    contextLength: 1000000,
    price: { prompt: 3, completion: 15 },
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openrouter",
    description: "Biến thể GPT-4.1 nhanh và giá cả phải chăng.",
    contextLength: 1047576,
    price: { prompt: 0.1, completion: 0.4 },
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openrouter",
    description: "Mô hình GPT-4.1 phân khúc trung với năng lực tốt.",
    contextLength: 1047576,
    price: { prompt: 0.4, completion: 1.6 },
  },
];

// Premium models from OpenRouter
const OPENROUTER_PREMIUM: ModelOption[] = [
  {
    id: "openai/gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "openrouter",
    description: "Mô hình hàng đầu của OpenAI. Tốt nhất cho suy luận và phân tích phức tạp.",
    contextLength: 1050000,
    price: { prompt: 10, completion: 50 },
  },
  {
    id: "~openai/gpt-sol-latest",
    name: "GPT Sol Latest",
    provider: "openrouter",
    description: "Họ GPT Sol thế hệ mới nhất. Giá trị chất lượng rất tốt.",
    contextLength: 1050000,
    price: { prompt: 2, completion: 10 },
  },
  {
    id: "~openai/gpt-astra-latest",
    name: "GPT Astra Latest",
    provider: "openrouter",
    description: "Họ GPT Astra thế hệ mới nhất. Được cập nhật với các năng lực mới nhất.",
    contextLength: 1050000,
    price: { prompt: 10, completion: 50 },
  },
  {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "openrouter",
    description: "Mô hình mạnh nhất của Anthropic. Xuất sắc cho suy luận phức tạp.",
    contextLength: 1000000,
    price: { prompt: 5, completion: 25 },
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "openrouter",
    description: "Sonnet mới nhất của Anthropic. Suy luận và phân tích mạnh.",
    contextLength: 1000000,
    price: { prompt: 2, completion: 10 },
  },
  {
    id: "anthropic/claude-opus-5",
    name: "Claude Opus 5",
    provider: "openrouter",
    description: "Mô hình hàng đầu của Anthropic cho các bài suy luận khó nhất.",
    contextLength: 1000000,
    price: { prompt: 5, completion: 25 },
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "openrouter",
    description: "Mô hình mạnh nhất của Google. Suy luận và phân tích mạnh.",
    contextLength: 1048576,
    price: { prompt: 1.25, completion: 10 },
  },
];

// ============================================
// GEMINI MODELS (Direct API)
// ============================================

/**
 * Gemini models reachable through the direct API.
 *
 * Only models that are actually served are listed: Google retired the
 * 2.x line for newer accounts and the 3.8 Pro model is not available on the
 * v1beta endpoint, so offering them in the settings screen only produced
 * requests that failed with 404.
 */
const GEMINI_MODELS: ModelOption[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "gemini",
    description: "Mô hình Gemini ổn định thế hệ mới nhất. Nhanh với khả năng suy luận xuất sắc.",
    contextLength: 1048576,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "gemini",
    description: "Năng lực nâng cao với khả năng suy luận tốt hơn. Dùng làm phương án dự phòng khi 3.8 Flash quá tải.",
    contextLength: 1048576,
  },
];

// ============================================
// EXPORTS
// ============================================

export const OPENROUTER_MODELS = [...FREE_MODELS, ...OPENROUTER_AFFORDABLE, ...OPENROUTER_PREMIUM];
export const ALL_MODELS = [...OPENROUTER_MODELS, ...GEMINI_MODELS];

// Default model. Gemini is the primary provider - the model id is read from
// GEMINI_MODEL in the environment - and the other provider is used as a
// fallback whenever Gemini answers 503 (overloaded).
export const DEFAULT_MODEL = "gemini-3.8-flash";
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
