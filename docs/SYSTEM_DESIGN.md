# SYSTEM_DESIGN.md — Quizzard System Architecture

This document covers deployment, infrastructure, database design, monitoring, and cross-cutting concerns not addressed in `ARCHITECTURE.md`.

---

## 1. Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript 5 |
| Database | SQLite (dev) → PostgreSQL (prod) via Prisma ORM |
| Auth | iron-session (cookie-based) |
| AI | Google Gemini API (`@google/generative-ai`) |
| UI | shadcn/ui + Tailwind CSS 4 |
| PDF Processing | `pdftotext` (poppler-utils) + `pdfplumber` |
| Math Evaluation | `mathjs` |
| Rate Limiting | `rate-limit` (in-memory, MVP) |
| Deployment Target | Vercel (recommended) or Node.js server |

**No substitutions**: The stack is locked. Do not introduce alternative databases, auth libraries, or AI providers without explicit instruction.

---

## 2. Environment Variables

### 2.1 Required Env Vars

```env
# Database
DATABASE_URL="file:./dev.db"                    # SQLite dev
# DATABASE_URL="postgresql://user:pass@host/db" # PostgreSQL prod

# Session
SESSION_SECRET="min-32-char-random-string-here"  # Generate with: openssl rand -base64 32

# AI — at least one provider required
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3.6-flash"              # Default model
OPENROUTER_API_KEY="your-openrouter-api-key"  # Optional alternative
OPENROUTER_DEFAULT_MODEL="deepseek/deepseek-v4.1-flash"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"   # For CORS / cookies
NODE_ENV="development"

# File Storage
FILE_STORAGE_PATH="./public/uploads"           # Relative to quizzard/ root
```

### 2.2 Optional Env Vars

```env
# AI Quota
GEMINI_DAILY_QUOTA=1000                       # Max API calls per day (optional)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000                    # Default: 1 minute
RATE_LIMIT_MAX=100                           # Default: 100 per window

# Logging
LOG_LEVEL="info"                              # debug | info | warn | error
```

> **Note**: `OPENROUTER_API_KEY` is supported as an alternative AI provider. If both are set, `GEMINI_API_KEY` takes precedence.

### 2.3 Env Var Management Rules
- Never commit `.env` files or any file containing secrets.
- All required env vars must be documented in this file.
- Code must fail fast if a required env var is missing:
  ```ts
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  ```

---

## 3. Database Design

### 3.1 Prisma Schema Conventions

- **Naming**: PascalCase model names, camelCase field names. Enum values: SCREAMING_SNAKE_CASE.
- **IDs**: Always `cuid()` — never auto-increment integers. CUIDs are sortable, web-safe, and prevent enumeration attacks.
- **Dates**: Use `DateTime` for all timestamps. Store in UTC. Format for display in the UI layer.
- **Relations**: Use explicit `onDelete` behavior on every relation. Default to `Cascade` for parent-child ownership relations; use `SetNull` only when the child entity should survive parent deletion.
- **Indexes**: Add `@@index` on foreign keys and frequently queried fields:
  ```prisma
  model StudentAttempt {
    // ... fields ...
    studentId String
    quizId    String

    @@index([studentId])
    @@index([quizId])
    @@index([status])
    @@unique([quizId, studentId]) // Already enforced
  }
  ```

### 3.2 Cascade Delete Policy

| Relation | Policy | Rationale |
|---|---|---|
| User → classesTaught | Cascade | Teacher deletes → all their classes gone |
| Class → enrollments, materials, lectures | Cascade | Class deletion removes all nested data |
| Class → teacher (via `Class.teacherId`) | SetNull | Teacher may exist without a class |
| Material → lectures | SetNull | Lectures survive material deletion |
| Lecture → quiz | Cascade | Lecture deletion removes quiz and attempts |
| Quiz → questionBank, attempts | Cascade | Quiz deletion removes all related data |
| QuestionBankItem → answers, reports | Cascade | Question deletion removes student data |
| StudentAttempt → answers | Cascade | Attempt deletion removes answers |
| StudentAnswer → reports | Cascade | Answer deletion removes reports |
| Enrollment → (no children) | — | Direct enrollment removal |

### 3.3 Database Migrations

```bash
# Development
npx prisma migrate dev --name <migration-name>

# Production (generate SQL, review, apply manually)
npx prisma migrate dev --create-only
# OR use Prisma Migrate in production:
npx prisma migrate deploy
```

**Migration rules**:
- Never edit a migration file that has been applied to a shared database.
- For schema changes in MVP (SQLite): `prisma db push` is acceptable for rapid iteration; switch to proper migrations before production.
- All schema changes must update the TypeScript interfaces in `docs/ARCHITECTURE.md` that mirror `Json` fields.

### 3.4 Connection Pooling (Production)

For PostgreSQL in production:
```env
DATABASE_URL="postgresql://.../?connection_limit=10&pool_timeout=10"
```

Set `connection_limit` based on your hosting plan. For Vercel serverless: use Prisma's connection pooling via the built-in accelerator or a service like Prisma Accelerate.

---

## 4. Folder Structure (Full)

> The Next.js app root is the `quizzard/` subdirectory. Route groups use flat `teacher/` and `student/` directories (no parentheses).

```
quizzard/                    # Next.js app root
├── app/
│   ├── (auth)/             # Auth pages (no layout needed)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── teacher/            # Teacher layout (auth guard)
│   │   ├── layout.tsx
│   │   ├── analytics/page.tsx         # Analytics + class/quiz leaderboards
│   │   ├── classes/
│   │   │   ├── page.tsx              # Class list
│   │   │   └── [classId]/
│   │   │       ├── page.tsx           # Class detail
│   │   │       ├── quizzes/
│   │   │       │   └── [quizId]/
│   │   │       │       ├── page.tsx           # Quiz detail
│   │   │       │       ├── question-bank/page.tsx
│   │   │       │       └── publish/page.tsx
│   │   │       └── lectures/page.tsx
│   │   └── settings/page.tsx
│   ├── student/            # Student layout (auth guard)
│   │   ├── layout.tsx
│   │   ├── classes/
│   │   │   ├── page.tsx             # Enrolled classes
│   │   │   ├── join/page.tsx        # Join by code
│   │   │   └── [classId]/
│   │   │       ├── page.tsx          # Class detail
│   │   │       ├── quiz/
│   │   │       │   └── [quizId]/
│   │   │       │       ├── page.tsx       # Quiz intro
│   │   │       │       ├── attempt/page.tsx
│   │   │       │       └── results/page.tsx
│   │   │       ├── leaderboard/page.tsx
│   │   │       └── full-leaderboard/page.tsx
│   │   ├── progress/page.tsx        # Learning progress tracker
│   │   ├── leaderboard/page.tsx      # Legacy quiz leaderboard (requires ?quizId=)
│   │   └── settings/page.tsx
│   ├── api/                           # API route handlers
│   │   ├── auth/
│   │   │   ├── signup/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── classes/
│   │   │   ├── route.ts
│   │   │   ├── enrollments/route.ts
│   │   │   └── [classId]/
│   │   │       ├── route.ts
│   │   │       ├── join/route.ts
│   │   │       ├── students/route.ts
│   │   │       └── leaderboard/route.ts
│   │   ├── materials/
│   │   │   ├── route.ts
│   │   │   └── [materialId]/
│   │   │       ├── route.ts
│   │   │       └── chat/route.ts    # Chat with material (AI)
│   │   ├── lectures/
│   │   │   ├── route.ts
│   │   │   └── [lectureId]/route.ts
│   │   ├── quizzes/
│   │   │   ├── route.ts
│   │   │   └── [quizId]/
│   │   │       ├── route.ts
│   │   │       ├── publish/route.ts
│   │   │       ├── deadline/route.ts
│   │   │       ├── preview/route.ts
│   │   │       ├── info/route.ts
│   │   │       ├── chat/route.ts    # Chat about quiz config (AI)
│   │   │       ├── leaderboard/route.ts
│   │   │       └── question-bank/
│   │   │           ├── route.ts
│   │   │           ├── generate/route.ts
│   │   │           ├── upload/route.ts  # Import CSV/XLSX
│   │   │           ├── export/route.ts   # Export as CSV
│   │   │           └── [itemId]/
│   │   │               ├── route.ts
│   │   │               └── status/route.ts
│   │   ├── attempts/
│   │   │   ├── route.ts          # GET list / POST start
│   │   │   └── [attemptId]/
│   │   │       ├── route.ts
│   │   │       └── submit/route.ts
│   │   ├── reports/
│   │   │   ├── route.ts
│   │   │   └── [reportId]/route.ts
│   │   ├── analytics/
│   │   │   └── teacher/
│   │   │       ├── route.ts
│   │   │       └── leaderboards/route.ts
│   │   ├── student/
│   │   │   └── progress/route.ts
│   │   ├── users/
│   │   │   ├── avatar/route.ts
│   │   │   ├── profile/route.ts
│   │   │   └── password/route.ts
│   │   └── revalidate/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                # shadcn/ui base components
│   ├── student-sidebar.tsx
│   ├── teacher-sidebar.tsx
│   ├── chat-panel.tsx
│   ├── qb-chat-panel.tsx
│   ├── logout-button.tsx
│   ├── settings/
│   └── hooks/
├── lib/
│   ├── db.ts              # Prisma client singleton
│   ├── config.ts          # Environment variable loader
│   ├── services/          # Business logic (one file per domain)
│   │   ├── auth.service.ts
│   │   ├── class.service.ts
│   │   ├── material.service.ts
│   │   ├── lecture.service.ts
│   │   ├── quiz.service.ts
│   │   ├── question-bank.service.ts
│   │   ├── attempt.service.ts
│   │   └── report.service.ts
│   ├── ai/
│   │   ├── gemini-client.ts        # callGeminiForJSON<T>
│   │   ├── available-models.ts
│   │   ├── chat.service.ts         # General AI chat
│   │   ├── chat-prompts.ts
│   │   ├── prompts.ts
│   │   ├── qb-chat.service.ts      # Question bank AI chat
│   │   ├── qb-chat-prompts.ts
│   │   └── generation.service.ts   # Question bank generation
│   ├── question-types/    # Strategy pattern
│   │   ├── mcq.strategy.ts
│   │   ├── short-answer.strategy.ts
│   │   ├── calculation.strategy.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── state-machines/
│   │   ├── quiz.state-machine.ts
│   │   ├── question.state-machine.ts
│   │   ├── attempt.state-machine.ts
│   │   └── index.ts
│   ├── pdf/
│   │   └── extract.ts     # pdf-parse wrapper
│   ├── middleware/
│   │   ├── auth.ts        # requireTeacher / requireStudent
│   │   └── rate-limit.ts
│   ├── validation/
│   │   └── schemas.ts     # Zod schemas
│   └── utils/
│       ├── errors.ts
│       ├── logger.ts
│       ├── error-handler.ts
│       └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
│   └── uploads/           # Uploaded PDFs (gitignored)
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
└── package.json


---

## 5. API Design

### 5.1 REST Conventions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/classes` | List teacher's classes |
| `POST` | `/api/classes` | Create class |
| `GET` | `/api/classes/:id` | Get class details |
| `PUT` | `/api/classes/:id` | Update class |
| `DELETE` | `/api/classes/:id` | Delete class |
| `POST` | `/api/classes/:id/join` | Student join class |
| `POST` | `/api/attempts` | Start quiz attempt |
| `PUT` | `/api/attempts/:id` | Save answer (auto-save) |
| `POST` | `/api/attempts/:id/submit` | Submit attempt |

### 5.2 Response Format

**Success**:
```ts
// Single resource
{ data: Class }

// List
{ data: Class[], total: number }

// With pagination
{ data: Class[], total: number, page: number, pageSize: number }
```

**Error**:
```ts
{ error: string, code?: string }
// Examples:
// { error: "Not found", code: "CLASS_NOT_FOUND" }
// { error: "Unauthorized", code: "UNAUTHORIZED" }
// { error: "Quiz deadline has passed", code: "DEADLINE_PASSED" }
```

### 5.3 HTTP Status Codes

| Code | Use |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | Success, no body (e.g., delete) |
| 400 | Validation error, business rule violation |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate enrollment, already attempted) |
| 429 | Rate limited |
| 500 | Server error (log details, return generic message) |

---

## 6. Quiz Attempt Flow (Sequence)

```
Student starts quiz
    │
    ▼
[Server] Validate deadline not passed ──→ 400 if past deadline
    │
    ▼
[Server] Check no existing attempt for (quizId, studentId) ──→ 409 if exists
    │
    ▼
[Server] Verify quiz is PUBLISHED ──→ 400 if not
    │
    ▼
[Server] Select N random APPROVED questions from pool
    │
    ▼
[Server] Roll CALCULATION variables (deterministic seeded random)
    │
    ▼
[Server] Build questionSnapshot JSON (content + answers, shuffled)
    │
    ▼
[Server] Create StudentAttempt (status: IN_PROGRESS)
    │
    ▼
[Server] Return attemptId + questions to client
    │
    ▼
[Client] Start countdown timer
    │
    ▼
[Student] Answers questions (auto-save every 30s to /api/attempts/:id)
    │
    ▼
[Student] Submits OR timer expires
    │
    ▼
[Server] transitionAttempt(IN_PROGRESS → SUBMITTED|AUTO_SUBMITTED)
    │
    ▼
[Server] Grade all answers via QuestionTypeStrategy
    │
    ▼
[Server] Save StudentAnswer records (isCorrect, pointsAwarded)
    │
    ▼
[Server] Calculate total score, update StudentAttempt.score
    │
    ▼
[Server] Return results
```

---

## 7. AI Generation Pipeline (Full)

### 7.1 Lecture Proposal
```
Teacher uploads PDF → Material PROCESSING → PDF text extracted
                                        │
                                        ▼
                    callGeminiForJSON(proposeLectures)
                                        │
                                        ▼
                    Lecture[] (title + sourceRef ranges)
                                        │
                                        ▼
                    Teacher reviews/edits → confirms
                                        │
                                        ▼
                    Quiz(DRAFT) created per lecture
```

### 7.2 Question Bank Generation
```
Teacher configures quiz → clicks "Generate Full Bank"
                                  │
                                  ▼
              poolSize = quiz.questionsPerAttempt × 5
              callGeminiForJSON(generateQuestions, { count: poolSize, instructions })
                                  │
                                  ▼
              QuestionBankItem[] (status: DRAFT)
                                  │
                                  ▼
              For each item: callGeminiForJSON(recheckQuestion)
                                  │
                                  ▼
              Item status: APPROVED (clean) | FLAGGED_FOR_REVIEW (issues found)
                                  │
                                  ▼
              Persist to DB via question-bank.service.ts
```

### 7.3 "Generate More" Flow
```
Teacher clicks "Generate more"
    │
    ▼
Pass existing question texts to generation prompt (avoid duplicates)
    │
    ▼
callGeminiForJSON(generateQuestions, { count: N, instructions, existingQuestions })
    │
    ▼
Same re-check pipeline applies to new items
    │
    ▼
Append to existing pool
```

---

## 8. Error Handling Strategy

### 8.1 Custom Error Classes

```ts
// lib/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class DeadlinePassedError extends AppError {
  constructor() {
    super("Quiz deadline has passed", "DEADLINE_PASSED", 400);
    this.name = "DeadlinePassedError";
  }
}

export class AttemptInProgressError extends AppError {
  constructor() {
    super("You already have an attempt in progress for this quiz", "ATTEMPT_EXISTS", 409);
    this.name = "AttemptInProgressError";
  }
}
```

### 8.2 Global API Error Handler

```ts
// app/api/_middleware/error-handler.ts
export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  // Unknown error — log it, return generic message
  console.error("Unhandled API error:", error);
  return Response.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}
```

### 8.3 Service Layer Error Propagation

Service functions should throw typed errors, not return error objects:
```ts
// Good
export async function getClass(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new NotFoundError("Class");
  if (cls.teacherId !== teacherId) throw new AuthorizationError();
  return cls;
}

// Bad
export async function getClass(classId: string, teacherId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return { error: "not_found" };
  return { data: cls };
}
```

---

## 9. Logging & Observability

### 9.1 Log Levels

| Level | Use |
|---|---|
| `debug` | Detailed flow tracing (dev only) |
| `info` | Request received, action completed |
| `warn` | Recoverable issues (e.g., AI retry, rate limit approaching) |
| `error` | Failures that need investigation |

### 9.2 Structured Logging Format

```ts
{
  "timestamp": "2026-08-24T15:00:00.000Z",
  "level": "info",
  "context": "quiz.publish",
  "userId": "cuid123",
  "quizId": "cuid456",
  "message": "Quiz published successfully",
  "duration_ms": 234
}
```

### 9.3 What to Log

**Always log**:
- Authentication events (login, logout, failed login)
- Quiz publish/unpublish
- Attempt start and submission (studentId, quizId, score)
- AI generation requests (token count if available)
- Rate limit hits
- Schema migrations applied

**Never log**:
- Passwords or password hashes
- Session tokens
- Full question content (unless debugging a specific issue)
- Personal data beyond userId

---

## 10. Testing Strategy

### 10.1 Test Types

| Type | Location | Scope |
|---|---|---|
| Unit | `*.test.ts` next to source file | Single function/class |
| Integration | `tests/integration/` | API routes + service |
| E2E | `tests/e2e/` (Playwright) | Full user flows |

### 10.2 What to Unit Test

- **State machines**: All transition functions — happy path and illegal transitions
- **Question type strategies**: `grade()` for all 4 types, `rollForStudent()`, `validateContent()`
- **CALCULATION formula evaluation**: Valid formulas, edge cases, invalid inputs
- **Zod validation schemas**: Boundary conditions
- **Randomization**: Deterministic seed produces same result

### 10.3 What to E2E Test (Playwright)

- Full teacher flow: signup → create class → upload PDF → generate quiz → publish
- Full student flow: signup → join class → take quiz → view results
- Deadline enforcement: attempt start rejected after deadline
- One attempt per quiz enforcement
- Leaderboard visibility

---

## 11. Deployment Guide

### 11.1 Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd quizzard
vercel

# Set env vars in Vercel dashboard:
# SESSION_SECRET, GEMINI_API_KEY, DATABASE_URL, NEXT_PUBLIC_APP_URL
```

**Database note for Vercel**: Use Prisma Accelerate or a managed PostgreSQL (Neon, Supabase, Railway). SQLite on Vercel is not recommended for production because the filesystem is ephemeral.

### 11.2 Self-Hosted (Node.js)

```bash
# Build
npm run build

# Start
NODE_ENV=production node .next/standalone/server.js

# Or with PM2
pm2 start ecosystem.config.js
```

**PM2 ecosystem config** (`ecosystem.config.js`):
```js
module.exports = {
  apps: [{
    name: "quizzard",
    script: ".next/standalone/server.js",
    env: {
      NODE_ENV: "production",
    },
    instances: "max",
    exec_mode: "cluster",
  }],
};
```

### 11.3 Environment-Specific Config

| Variable | Development | Production |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Your domain |
| `SESSION_SECRET` | Dev secret (32+ chars) | Generate cryptographically random |
| `DATABASE_URL` | SQLite file | PostgreSQL connection string |
| Rate limiting | Disabled or relaxed | Enabled |

---

## 12. Performance Considerations

### 12.1 Question Bank Draw (At Attempt Start)

Drawing N questions from a pool of ~5N can be done with a simple random shuffle + slice. For very large pools (1000+ questions), consider:
- Database-level random: `ORDER BY RANDOM()` (SQLite) or `ORDER BY RANDOM()` (PostgreSQL) with LIMIT
- Pre-shuffle with deterministic seed per attempt

### 12.2 CALCULATION Variable Rolling

Rolling is CPU-light (mathjs evaluate). Do it server-side at attempt start, store in `questionSnapshot`. No need to roll on every grade check.

### 12.3 Auto-Save (Client-Side)

The client should auto-save answers every 30 seconds to prevent data loss:
```
POST /api/attempts/:id
{ answers: [{ questionBankItemId, partialAnswer }] }
```
The server saves the partial answer. On final submit, overwrite with the full answer set.

### 12.4 PDF Processing

PDF text extraction can be slow (5-30 seconds for large files). Process asynchronously:
1. Upload → return `PROCESSING` status immediately
2. Background job extracts text
3. Store extracted text in DB (or re-extract on-demand for lecture proposal)
4. Webhook/polling to update status to `PROCESSED` or `FAILED`

---

## 13. Scalability Boundaries

| Concern | MVP / SQLite | Production Target |
|---|---|---|
| Users per class | ~50 | 500+ |
| Questions per quiz pool | ~100 | 500+ |
| Concurrent quiz attempts | ~10 | 100+ |
| PDF file size | 50MB | 50MB |
| Total storage | Single file | PostgreSQL + file storage |

If scaling beyond these boundaries, consider:
- Switching from SQLite to PostgreSQL
- Moving file storage to S3/R2
- Adding Redis for session management and rate limiting
- Implementing a job queue for AI generation (BullMQ, Inngest)
