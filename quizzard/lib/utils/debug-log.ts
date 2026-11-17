/**
 * Temporary debug instrumentation (debug session 657f29).
 *
 * Posts NDJSON payloads to the local debug ingest endpoint so the runtime
 * evidence of a failing request can be read back from the log file.
 */

const DEBUG_ENDPOINT =
  "http://127.0.0.1:7643/ingest/0cb14382-f394-4521-a685-f858a9d2a5ea";

const SESSION_ID = "657f29";

export function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {}
): void {
  try {
    const payload = {
      sessionId: SESSION_ID,
      runId: "debug",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    };

    void fetch(DEBUG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": SESSION_ID,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Instrumentation must never break the request.
  }
}
