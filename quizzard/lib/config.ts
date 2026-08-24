import { z } from "zod";

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable is required`);
  return val;
};

export const config = {
  db: {
    url: required("DATABASE_URL"),
  },
  session: {
    secret: required("SESSION_SECRET"),
  },
  gemini: {
    apiKey: required("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    nodeEnv: process.env.NODE_ENV ?? "development",
  },
  fileStorage: {
    path: process.env.FILE_STORAGE_PATH ?? "./public/uploads",
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
