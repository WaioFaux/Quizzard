# Quizzard (API)

Backend API for the Quizzard quiz platform. Built with Next.js 16 App Router.

## Quick Links

- **User docs / project overview** — see `../README.md` (root directory)
- **Technical specifications** — see `../docs/` (PRD, Architecture, System Design, Security, AGENTS)
- **For AI coding agents** — see `./AGENTS.md`

## Setup

```bash
npm install
cp .env.example .env.local  # then fill in GEMINI_API_KEY and SESSION_SECRET
npx prisma generate
npx prisma db push
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run test` | Tests in watch mode |
| `npm run test:run` | Tests once |
| `npm run lint` | ESLint |
| `npm run db:push` | Push schema changes |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Prisma Studio |

## API Routes

### Auth
- `POST /api/auth/signup` — Create account (TEACHER | STUDENT)
- `POST /api/auth/login` — Log in
- `POST /api/auth/logout` — Log out
- `GET /api/auth/me` — Get current user

### Classes
- `GET /api/classes` — List teacher's classes (TEACHER)
- `POST /api/classes` — Create class (TEACHER)
- `GET /api/classes/:id` — Get class details (TEACHER)
- `PUT /api/classes/:id` — Update class (TEACHER)
- `DELETE /api/classes/:id` — Delete class (TEACHER)
- `POST /api/classes/:id/join` — Join class (STUDENT)
- `GET /api/classes/:id/students` — List enrolled students (TEACHER)
- `GET /api/classes/:id/leaderboard` — Class-wide leaderboard
- `GET /api/classes/enrollments` — List student's enrollments (STUDENT)

### Materials
- `POST /api/materials` — Upload PDF (TEACHER)
- `GET /api/materials/:id` — Get material details (TEACHER)
- `DELETE /api/materials/:id` — Delete material (TEACHER)
- `GET /api/materials/:id/chat` — Chat with material content (AI)

### Lectures
- `GET /api/lectures?classId=` — List lectures (TEACHER)
- `POST /api/lectures` — Create lecture manually (TEACHER)
- `GET /api/lectures/:id` — Get lecture details (TEACHER)
- `PUT /api/lectures/:id` — Update lecture (TEACHER)
- `DELETE /api/lectures/:id` — Delete lecture (TEACHER)

### Quizzes
- `POST /api/quizzes` — Create quiz (TEACHER)
- `GET /api/quizzes/:id` — Get quiz details (TEACHER)
- `PUT /api/quizzes/:id` — Update quiz config (TEACHER)
- `POST /api/quizzes/:id/publish` — Publish quiz (TEACHER)
- `PUT /api/quizzes/:id/deadline` — Extend deadline (TEACHER)
- `GET /api/quizzes/:id/info` — Quiz info for students
- `GET /api/quizzes/:id/preview` — Generate sample questions (AI)
- `GET /api/quizzes/:id/leaderboard` — Quiz leaderboard
- `GET /api/quizzes/:id/chat` — Chat about quiz config (AI)

### Question Bank
- `GET /api/quizzes/:quizId/question-bank` — List questions (TEACHER)
- `POST /api/quizzes/:quizId/question-bank` — Add manual question (TEACHER)
- `POST /api/quizzes/:quizId/question-bank/generate` — Generate full bank (AI)
- `POST /api/quizzes/:quizId/question-bank/upload` — Import CSV/XLSX
- `GET /api/quizzes/:quizId/question-bank/export` — Export as CSV
- `GET /api/quizzes/:quizId/question-bank/:itemId` — Get question (TEACHER)
- `PUT /api/quizzes/:quizId/question-bank/:itemId` — Update question (TEACHER)
- `DELETE /api/quizzes/:quizId/question-bank/:itemId` — Delete question (TEACHER)
- `PUT /api/quizzes/:quizId/question-bank/:itemId/status` — Approve/flag (TEACHER)

### Attempts
- `GET /api/attempts` — List student's attempts (STUDENT)
- `POST /api/attempts` — Start attempt (STUDENT)
- `GET /api/attempts/:id` — Get attempt (STUDENT)
- `PUT /api/attempts/:id` — Auto-save answers (STUDENT)
- `POST /api/attempts/:id/submit` — Submit attempt (STUDENT)

### Reports
- `POST /api/reports` — Submit question report (STUDENT)
- `GET /api/reports` — List reports (TEACHER)
- `PUT /api/reports/:id` — Resolve report (TEACHER)

### Analytics
- `GET /api/analytics/teacher` — Per-class stats, recent submissions
- `GET /api/analytics/teacher/leaderboards` — Class + quiz leaderboards

### Student Progress
- `GET /api/student/progress` — Overall progress across all classes (STUDENT)

## Project Structure

```
app/
  (auth)/                     # Login / signup pages
  teacher/                    # Teacher-facing pages
  student/                    # Student-facing pages
  api/                       # API route handlers
lib/
  config.ts                  # Environment variable loader
  db.ts                      # Prisma client singleton
  services/                  # Business logic (one file per domain)
  middleware/
    auth.ts                  # Session validation & role guards
    rate-limit.ts            # Per-user + per-IP rate limiting
  question-types/            # Strategy pattern for grading (MCQ, SHORT_ANSWER, CALCULATION)
  state-machines/             # Entity state transitions (quiz, question, attempt)
  ai/                        # AI services (Gemini client, chat, generation)
  pdf/                       # PDF text extraction
  utils/
    errors.ts                # Typed error classes
    logger.ts                # Structured JSON logging
    error-handler.ts         # API error handler
    validation/schemas.ts     # Zod schemas
prisma/
  schema.prisma              # Database schema
```
