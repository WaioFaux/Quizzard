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
    defaultModel: optional("OPENROUTER_DEFAULT_MODEL") ?? "deepseek/deepseek-v4.1-flash",
  },
  gemini: {
    apiKey: optional("GEMINI_API_KEY"),
    model: optional("GEMINI_MODEL") ?? "gemini-3.6-flash",
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
