# ARCHITECTURE.md — Quizzard

Technical conventions and required patterns. Read before writing API routes, services, or anything touching Prisma `Json` fields.

## Folder structure

The Next.js App Router project lives in the `quizzard/` subdirectory.

```
quizzard/app/
  (auth)/                    # Login / signup pages
    login/page.tsx
    signup/page.tsx
  teacher/                   # Teacher-facing routes (flat, no parentheses)
    analytics/page.tsx       # Analytics dashboard + leaderboard tabs
    classes/
      page.tsx               # Class list
      [classId]/
        page.tsx             # Class detail (tabs: Quizzes, Lectures, Materials, Students)
        quizzes/
          [quizId]/
            page.tsx         # Quiz detail / configure
            question-bank/
              page.tsx       # Question bank management
            publish/
              page.tsx       # Publish confirmation
        lectures/page.tsx
    reports/page.tsx
  student/                   # Student-facing routes (flat, no parentheses)
    classes/
      page.tsx               # Enrolled classes list
      join/page.tsx          # Join class by code
      [classId]/
        page.tsx             # Class detail
        quiz/
          [quizId]/
            page.tsx         # Quiz intro / start
            attempt/page.tsx # Quiz-taking interface
            results/page.tsx # Results view
        leaderboard/page.tsx  # Class leaderboard
        full-leaderboard/page.tsx
    progress/page.tsx         # Learning progress tracker
    leaderboard/page.tsx      # Legacy quiz leaderboard (requires ?quizId=)
  api/
    auth/
      signup/route.ts
      login/route.ts
      logout/route.ts
      me/route.ts
    classes/
      route.ts               # List / create classes
      [classId]/
        route.ts             # Get / update / delete class
        join/route.ts        # Student join class
        students/route.ts    # List enrolled students
        leaderboard/route.ts # Class-wide leaderboard
      enrollments/route.ts   # Student's enrollments
    materials/
      route.ts               # Upload material
      [materialId]/
        route.ts             # Get / delete material
        chat/route.ts        # Chat with material (AI)
    lectures/
      route.ts               # List / create lectures
      [lectureId]/route.ts   # Get / update / delete lecture
    quizzes/
      route.ts               # Create quiz
      [quizId]/
        route.ts             # Get / update quiz
        publish/route.ts     # Publish quiz
        deadline/route.ts    # Extend deadline
        preview/route.ts    # Generate sample questions (AI)
        info/route.ts        # Quiz info for students
        chat/route.ts        # Chat about quiz config (AI)
        leaderboard/route.ts # Quiz-specific leaderboard
        question-bank/
          route.ts           # List questions
          generate/route.ts  # Generate full bank (AI)
          upload/route.ts    # Import CSV/XLSX
          export/route.ts    # Export as CSV
          [itemId]/
            route.ts         # Get / update / delete question
            status/route.ts  # Approve / flag question
    attempts/
      route.ts               # List student attempts (GET) / start attempt (POST)
      [attemptId]/
        route.ts             # Get / auto-save attempt
        submit/route.ts      # Submit attempt
    reports/
      route.ts               # List reports (TEACHER) / submit report (STUDENT)
      [reportId]/route.ts    # Resolve report (TEACHER)
    analytics/
      teacher/
        route.ts             # Per-class stats, recent submissions
        leaderboards/route.ts # Class + quiz leaderboards for teachers
    student/
      progress/route.ts       # Student progress across all classes
    users/
      avatar/route.ts        # Upload avatar
      profile/route.ts       # Get / update profile
      password/route.ts      # Change password
    revalidate/route.ts      # On-demand ISR revalidation
    [reportId]/route.ts
lib/
  services/                  # one file per domain — all business logic lives here
    auth.service.ts
    class.service.ts
    material.service.ts
    lecture.service.ts
    quiz.service.ts
    question-bank.service.ts
    attempt.service.ts
    report.service.ts
  ai/
    gemini-client.ts         # callGeminiForJSON<T> adapter — the ONLY place that calls Gemini
    gemini-client.ts
    available-models.ts      # Available model list
    chat.service.ts          # General AI chat
    chat-prompts.ts
    prompts.ts
    qb-chat.service.ts       # Question bank AI chat
    qb-chat-prompts.ts
    generation.service.ts    # Question bank generation orchestration
  question-types/             # Strategy pattern, one file per QuestionType
    mcq.strategy.ts
    short-answer.strategy.ts
    calculation.strategy.ts
    types.ts
    index.ts                 # strategy registry keyed by QuestionType
  state-machines/
    quiz.state-machine.ts
    question.state-machine.ts
    attempt.state-machine.ts
    index.ts
  pdf/
    extract.ts               # pdf-parse wrapper for PDF text extraction
  middleware/
    auth.ts                 # requireTeacher / requireStudent session helpers
    rate-limit.ts            # Per-user + per-IP rate limiting
  validation/
    schemas.ts               # Zod schemas for all API inputs
  utils/
    errors.ts               # Typed error classes (AppError, NotFoundError, etc.)
    logger.ts               # Structured JSON logging
    error-handler.ts        # handleApiError() for API routes
    schemas.ts
    schemas.test.ts
    errors.test.ts
    utils.ts
prisma/
  schema.prisma
  migrations/
components/
  ui/                        # shadcn/ui base components
  student-sidebar.tsx
  teacher-sidebar.tsx
  chat-panel.tsx             # General AI chat panel
  qb-chat-panel.tsx          # Question bank generation chat panel
  logout-button.tsx
  settings/
    avatar-upload.tsx
  hooks/
    use-toast.ts
```

Route handlers stay thin: parse input, call a service function, return the result. All logic, validation, and Prisma calls live in `lib/services/*`.

## Core patterns

### 1. Service Layer
Every domain concept (`Class`, `Quiz`, `QuestionBank`, `Attempt`, ...) gets one service file with plain exported functions (not a class). Route handlers and server actions call these — never call `prisma.*` directly from a route handler or component.

### 2. Strategy pattern for `QuestionType`
Each question type (`MCQ`, `SHORT_ANSWER`, `CALCULATION`) implements the same interface:

```ts
interface QuestionTypeStrategy {
  validateContent(content: unknown): boolean;
  renderForStudent(content: QuestionContent): StudentFacingQuestion; // strips the correct answer
  grade(answer: unknown, correctAnswer: unknown): { isCorrect: boolean; pointsAwarded: number };
  rollForStudent?(content: CalculationContent, seed: string): CalculationContent; // CALCULATION only
}
```
`CALCULATION.grade` and `CALCULATION.rollForStudent` evaluate the stored formula with `mathjs.evaluate` — never `eval()`.

### 3. State machines
One `transitionX()` function per stateful entity (`Quiz`, `QuestionBankItem`, `StudentAttempt`). Each function takes the current status and the target status, throws on an illegal transition, and is the only code path allowed to write that entity's `status` column. Legal transitions are defined in `docs/PRD.md` §8.

### 4. Gemini API Adapter
```ts
async function callGeminiForJSON<T>(params: {
  prompt: string;
  schemaDescription: string; // instructs Gemini to return only JSON matching this shape
}): Promise<T>
```
- Reads the model id from `process.env.GEMINI_MODEL` — never hardcode a model string in a prompt file or service.
- Strips markdown code fences before `JSON.parse`.
- Throws a typed error on parse failure; callers decide whether to retry.
- This is the only function in the codebase that calls the Gemini API.

### 5. Blind re-check pipeline
```ts
async function generateQuestionBank(quizId: string, count: number, instructions: string): Promise<QuestionBankItem[]>
```
Pipeline stages, each a separate function so they can be tested independently:
1. `generate(instructions, count)` → raw `QuestionBankItem[]` at `DRAFT`, via `callGeminiForJSON`.
2. `recheck(item)` → an independent second `callGeminiForJSON` call per item; sets `FLAGGED_FOR_REVIEW` or `APPROVED`. This must be a separate prompt/call — never reuse the generation call's own output as its own check.
3. `persist(items)` → write to `QuestionBankItem` via the service layer.

"Generate more" re-enters the same pipeline with a fresh `instructions` string and appends to the existing pool; pass the existing pool's question texts into the generation prompt so the model avoids near-duplicates.

## `Json` field shapes

Prisma stores these as untyped `Json`. Define and export a TypeScript interface for each, and validate against it (e.g. with `zod`) on every read/write — never treat a `Json` field as `any` in service code.

### `Lecture.sourceRef`
```ts
interface SourceRef {
  materialId: string;
  startPage: number;
  endPage: number;
}
```
Stored as `Json?` in the database, validated against the `SourceRef` interface on every read/write.

### `QuestionBankItem.content`
Discriminated by the sibling `type` column:
```ts
type QuestionContent =
  | { type: "MCQ"; prompt: string; options: string[]; correctOptionIndex: number; explanation?: string }
  | { type: "SHORT_ANSWER"; prompt: string; correctAnswer: string; explanation?: string }
  | {
      type: "CALCULATION";
      promptTemplate: string;   // e.g. "A firm has revenue {a} and cost {b}. Compute the margin."
      variables: { name: string; min: number; max: number; decimals?: number }[];
      answerFormula: string;    // mathjs expression referencing variable names, e.g. "(a - b) / a"
      explanation?: string;
    };
```

### `StudentAttempt.questionSnapshot`
The exact set of questions this student was given, in draw order, with any CALCULATION variables already rolled to concrete numbers:
```ts
interface QuestionSnapshotItem {
  questionBankItemId: string;
  type: QuestionType;
  content: QuestionContent;      // CALCULATION: promptTemplate already interpolated, answerFormula's variables fixed to rolled numbers
  shuffledOptionOrder?: number[]; // MCQ only — maps displayed order back to original option indices
}
type QuestionSnapshot = QuestionSnapshotItem[];
```

### `StudentAnswer.answer`
```ts
type StudentAnswerValue =
  | { type: "MCQ"; selectedOptionIndex: number }
  | { type: "SHORT_ANSWER"; text: string }
  | { type: "CALCULATION"; value: number };
```

### `StudentAnswer.correctAnswerSnapshot`
Same shape as the matching `StudentAnswerValue` variant, frozen at grading time so later bank edits can never change a past attempt's record.

## Coding conventions

- Server-only code (`lib/services`, `lib/ai`) never imports client components.
- All dates handled as `DateTime` in UTC; format for display at the UI layer only.
- No implicit `any` — every `Json` field access goes through one of the typed interfaces above.
- Keep components and route handlers small; push anything with a branch or a loop into a service or strategy function.
- PDF text extraction: `pdftotext -layout` for body text (handles Vietnamese diacritics correctly); `pdfplumber` for pages with complex tables.

## 6. Error Handling

All service functions throw typed errors. Route handlers catch and convert them to API responses.

### Error class hierarchy
```ts
// lib/utils/errors.ts
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) { super(message); }
}

class AuthorizationError extends AppError {
  constructor(msg = "Unauthorized") {
    super(msg, "UNAUTHORIZED", 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}

class ValidationError extends AppError {
  constructor(msg: string) {
    super(msg, "VALIDATION_ERROR", 400);
  }
}

class ConflictError extends AppError {
  constructor(msg: string) {
    super(msg, "CONFLICT", 409);
  }
}
```

### API error handler
```ts
// Place at the top of every API route handler
export async function GET(req: Request) {
  try {
    // ... handler body ...
  } catch (err) {
    if (err instanceof AppError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error(err); // log full detail server-side
    return Response.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
```

### Service layer pattern
```ts
// Every service function throws — never returns { error: ... }
export async function getClass(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new NotFoundError("Class");
  if (cls.teacherId !== teacherId) throw new AuthorizationError();
  return cls;
}
```

## 7. Auth Middleware & Role Guard

Every API route that requires authentication calls the session validator first:

```ts
// lib/middleware/auth.ts
export async function requireAuth(req: Request) {
  const session = await getIronSession(req);
  if (!session?.userId) {
    throw new AuthorizationError("Login required");
  }
  if (session.expiresAt && session.expiresAt < Date.now()) {
    throw new AuthorizationError("Session expired");
  }
  return session; // { userId: string, role: "TEACHER" | "STUDENT" }
}

// Usage in API route:
const session = await requireAuth(req);
if (session.role !== "TEACHER") throw new AuthorizationError("Teacher access required");
```

## 8. Input Validation (Zod)

Every API handler validates request body/query params with Zod before any service call:

```ts
import { z } from "zod";

const CreateClassSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  classPassword: z.string().min(4).max(50),
});

// In route handler:
const parsed = CreateClassSchema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: parsed.error.message, code: "VALIDATION_ERROR" }, { status: 400 });
}
const { name, description, classPassword } = parsed.data;
```

## 9. Logging

Use structured JSON logging for all significant events. Never log passwords, tokens, or full question content.

```ts
// lib/utils/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, context: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    context,
    ...data,
  }));
}

// Usage:
log("info", "quiz.publish", { userId, quizId, duration_ms: elapsed });
```

**Always log**: login attempts (success/fail), quiz publish, attempt start/submit, AI generation requests, migration events, rate limit hits.

**Never log**: passwords, session tokens, personal content beyond userId.

## 10. API Response Format

All API routes use a consistent envelope:

```ts
// Success — single resource
{ data: Class }

// Success — list
{ data: Class[], total: number }

// Error
{ error: string, code: string }
```

Standard status codes: 200 OK · 201 Created · 204 No Content · 400 Bad Request · 401 Unauthenticated · 403 Forbidden · 404 Not Found · 409 Conflict · 429 Rate Limited · 500 Server Error

## 11. Environment Variables

All required env vars (documented in `docs/SYSTEM_DESIGN.md`). Validate at startup:

```ts
// lib/config.ts
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
} as const;

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable is required`);
  return val;
}
```

## Coding conventions

- Server-only code (`lib/services`, `lib/ai`) never imports client components.
- All dates handled as `DateTime` in UTC; format for display at the UI layer only.
- No implicit `any` — every `Json` field access goes through one of the typed interfaces above.
- Keep components and route handlers small; push anything with a branch or a loop into a service or strategy function.
- PDF text extraction: `pdftotext -layout` for body text (handles Vietnamese diacritics correctly); `pdfplumber` for pages with complex tables.
