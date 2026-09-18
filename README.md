# Quizzard

Quiz platform where teachers use AI to generate question banks from course materials and students take randomized, timed quizzes.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Auth | iron-session (cookie-based) |
| AI | Google Gemini API (via `@google/generative-ai`) |
| UI | shadcn/ui + Tailwind CSS 4 |
| PDF Processing | `pdf-parse` |
| Math Evaluation | `mathjs` |
| Rate Limiting | In-memory (per-user + per-IP) |

## Features

### Teacher Flow
1. Create a class with a join code
2. Upload PDF course materials
3. Configure quiz instructions (topic, difficulty, question types, count, time limit)
4. Preview sample AI-generated questions and iterate on instructions
5. Generate the full question bank — AI creates a fixed pool; each question passes through a blind re-check pipeline
6. Review, approve, edit, or delete individual questions (or import via CSV/XLSX)
7. Publish the quiz — students see it under the class; the bank becomes immutable
8. Monitor results, leaderboards, and student-submitted question reports

### Student Flow
1. Join a class using a class code + password
2. See all quizzes in enrolled classes (available, completed, or missed)
3. Start a quiz before the deadline — draw a random subset from the approved pool
4. Answer within the time limit; countdown auto-submits on expiry
5. View results with per-question correct/incorrect and explanations
6. Report a problem with any question to the teacher
7. Track overall learning progress across all classes

## Prerequisites

- Node.js 20+
- npm 9+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Setup

```bash
# 1. Enter the project directory
cd quizzard

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and fill in your SESSION_SECRET and GEMINI_API_KEY

# 4. Set up the database
npx prisma generate
npx prisma db push

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite: `file:./dev.db` · PostgreSQL: `postgresql://...` |
| `SESSION_SECRET` | Yes | Random string, minimum 32 characters. Generate with `openssl rand -base64 32` |
| `GEMINI_API_KEY` | Yes | Key from Google AI Studio |
| `GEMINI_MODEL` | No | Gemini model id (default: `gemini-3.6-flash`) |
| `OPENROUTER_API_KEY` | No | Alternative AI provider |
| `OPENROUTER_DEFAULT_MODEL` | No | OpenRouter model id |
| `NEXT_PUBLIC_APP_URL` | No | App URL for CORS/cookies (default: `http://localhost:3000`) |
| `FILE_STORAGE_PATH` | No | Uploaded file storage path (default: `./public/uploads`) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production app |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run db:push` | Push schema changes to the database |
| `npm run db:migrate` | Create and apply a database migration |
| `npm run db:studio` | Open Prisma Studio to browse the database |

## Documentation

Full technical specifications are in the `docs/` directory:

| Document | Purpose |
|---|---|
| `docs/PRD.md` | Product requirements, terminology, user flows, locked decisions, build order |
| `docs/ARCHITECTURE.md` | Folder structure, design patterns, `Json` field shapes, coding conventions |
| `docs/SYSTEM_DESIGN.md` | Tech stack, env vars, database design, API reference, deployment guide |
| `docs/SECURITY.md` | Authentication, RBAC, input validation, AI security, pre-production checklist |
| `docs/AGENTS.md` | Agent instructions, five non-negotiable design decisions |
