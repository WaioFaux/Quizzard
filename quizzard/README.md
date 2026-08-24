# Quizzard API

Backend API for the Quizzard quiz platform. Built with Next.js 16 App Router.

## Prerequisites

- Node.js 20+
- npm or pnpm

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

Required variables:
- `DATABASE_URL` — SQLite path for dev, PostgreSQL for prod
- `SESSION_SECRET` — minimum 32 character random string
- `GEMINI_API_KEY` — Google AI API key (for AI features)

### 3. Initialize database

```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push
```

### 4. Run development server

```bash
npm run dev
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests once
npm run test:run

# With coverage
npm run test:coverage
```

## API Routes

### Auth
- `POST /api/auth/signup` — Create account (TEACHER | STUDENT)
- `POST /api/auth/login` — Log in
- `POST /api/auth/logout` — Log out

### Classes
- `GET /api/classes` — List teacher's classes (TEACHER)
- `POST /api/classes` — Create class (TEACHER)
- `GET /api/classes/:id` — Get class details
- `PUT /api/classes/:id` — Update class (TEACHER)
- `DELETE /api/classes/:id` — Delete class (TEACHER)
- `POST /api/classes/:id/join` — Join class (STUDENT)
- `GET /api/classes/:id/students` — List enrolled students (TEACHER)
- `GET /api/classes/enrollments` — List student's enrollments (STUDENT)

### Materials
- `POST /api/materials` — Upload PDF (TEACHER)
- `GET /api/materials/:id` — Get material details (TEACHER)
- `DELETE /api/materials/:id` — Delete material (TEACHER)

### Lectures
- `GET /api/lectures?classId=` — List lectures (TEACHER)
- `POST /api/lectures` — Create lecture manually (TEACHER)
- `GET /api/lectures/:id` — Get lecture details (TEACHER)
- `PUT /api/lectures/:id` — Update lecture (TEACHER)
- `DELETE /api/lectures/:id` — Delete lecture (TEACHER)

### Quizzes
- `POST /api/quizzes` — Create quiz (TEACHER)
- `GET /api/quizzes/:id` — Get quiz details (TEACHER)
- `PUT /api/quizzes/:id` — Update quiz (TEACHER)
- `POST /api/quizzes/:id/publish` — Publish quiz (TEACHER)
- `PUT /api/quizzes/:id/deadline` — Extend deadline (TEACHER)
- `GET /api/quizzes/:id/leaderboard` — Get leaderboard

### Question Bank
- `GET /api/quizzes/:quizId/question-bank` — List questions (TEACHER)
- `POST /api/quizzes/:quizId/question-bank` — Add manual question (TEACHER)
- `GET /api/quizzes/:quizId/question-bank/:itemId` — Get question (TEACHER)
- `PUT /api/quizzes/:quizId/question-bank/:itemId` — Update question (TEACHER)
- `DELETE /api/quizzes/:quizId/question-bank/:itemId` — Delete question (TEACHER)
- `PUT /api/quizzes/:quizId/question-bank/:itemId/status` — Update status (TEACHER)

### Attempts
- `POST /api/attempts` — Start attempt (STUDENT)
- `GET /api/attempts/:id` — Get attempt (STUDENT)
- `PUT /api/attempts/:id` — Auto-save answers (STUDENT)
- `POST /api/attempts/:id/submit` — Submit attempt (STUDENT)

### Reports
- `POST /api/reports` — Submit question report (STUDENT)
- `GET /api/reports` — List reports (TEACHER)

## Project Structure

```
lib/
  config.ts                    # Environment variable loader
  db.ts                        # Prisma client singleton
  services/                    # Business logic (one file per domain)
  middleware/auth.ts            # Session validation & role guards
  question-types/              # Strategy pattern for grading
  state-machines/              # Entity state transitions
  utils/
    errors.ts                 # Typed error classes
    logger.ts                 # Structured JSON logging
    error-handler.ts          # API error handler
    validation/schemas.ts     # Zod schemas
```
