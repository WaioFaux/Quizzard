import { z } from "zod";

// Optional env var helper - returns undefined if not set
const optional = (key: string): string | undefined => {
  return process.env[key];
};

export const config = {
  db: {
    url: optional("DATABASE_URL") ?? "file:./dev.db",
  },
  session: {
    secret: optional("SESSION_SECRET") ?? "dev-secret-change-in-production",
  },
  openrouter: {
    apiKey: optional("OPENROUTER_API_KEY"),
    defaultModel: optional("OPENROUTER_DEFAULT_MODEL") ?? "baidu/ernie-5.5-flash-preview:free",
  },
  gemini: {
    apiKey: optional("GEMINI_API_KEY"),
    model: optional("GEMINI_MODEL") ?? "gemini-3.8-flash",
    // Models tried, in order, when the primary one is unavailable. Gemini
    // answers 503 "high demand" when a model is overloaded and 429 when the
    // key quota is spent, so a second model often succeeds where the first
    // one cannot.
    fallbackModels: (optional("GEMINI_FALLBACK_MODELS") ?? "gemini-3.5-flash")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean),
  },
  ai: {
    // Hard ceiling for a single provider call. Serverless functions have a
    // fixed wall-clock budget, so a provider that never answers must not be
    // allowed to consume all of it.
    requestTimeoutMs: parseInt(optional("AI_REQUEST_TIMEOUT_MS") ?? "20000", 10),
    // Total wall-clock budget for one logical AI call, covering every retry
    // and the fallback to the second provider. Keeps a request inside the
    // serverless function limit so the client gets a real error message
    // instead of a connection reset.
    totalBudgetMs: parseInt(optional("AI_TOTAL_BUDGET_MS") ?? "45000", 10),
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    nodeEnv: process.env.NODE_ENV ?? "development",
  },
  fileStorage: {
    // Uploads are stored in Vercel Blob; the local filesystem is not writable
    // on serverless deployments.
    provider: "vercel-blob" as const,
    maxMaterialBytes: 50 * 1024 * 1024,
    maxAvatarBytes: 2 * 1024 * 1024,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
  },
  log: {
    level: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
  },
} as const;

export type Config = typeof config;
