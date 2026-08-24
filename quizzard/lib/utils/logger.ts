type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITY[level] >= LOG_PRIORITY[currentLevel];
}

export function log(
  level: LogLevel,
  context: string,
  data: Record<string, unknown> = {}
): void {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    ...data,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (context: string, data?: Record<string, unknown>) =>
    log("debug", context, data),
  info: (context: string, data?: Record<string, unknown>) =>
    log("info", context, data),
  warn: (context: string, data?: Record<string, unknown>) =>
    log("warn", context, data),
  error: (context: string, data?: Record<string, unknown>) =>
    log("error", context, data),
};
