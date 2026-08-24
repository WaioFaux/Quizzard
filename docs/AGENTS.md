# AGENTS.md — Quizzard

Root context for AI coding agents (Cursor Agent Mode). Read this first, in full, before touching any code. Detailed specs live in `docs/PRD.md` and `docs/ARCHITECTURE.md` — load whichever is relevant to the task at hand.

## What this project is

Quizzard is a quiz platform built around a teacher → AI → teacher-approval → student pipeline: a teacher configures instructions for a lecture, the AI generates a fixed pool of questions, the teacher reviews and publishes that pool, and each student who takes the quiz draws a randomized subset from that same approved pool. It is **not** a tool that generates a fresh quiz per student in real time.

## Tech stack (do not substitute or add alternatives)

- Next.js (App Router) + TypeScript
- Prisma ORM + SQLite
- shadcn/ui + Tailwind CSS
- Google Gemini API — model id read from `process.env.GEMINI_MODEL`, never hardcoded
- iron-session for auth (cookie session, no OAuth, no password reset flow)
- `mathjs` (`evaluate`) for CALCULATION-type answer scoring — **never** use `eval()`

## Five non-negotiable design decisions

These are locked. Do not simplify them away even if a more obvious implementation suggests itself. If a task seems to require violating one of these, stop and flag it rather than proceeding.

1. **Fixed Question Bank pool model.** A quiz has one AI-generated pool of questions (default size = 5× the per-attempt draw count). Every student's attempt is a random subset drawn from that same approved pool — never a fresh AI generation per student.
2. **No AI calls at quiz-taking time.** Generation and blind re-check happen asynchronously, before publish. When a student takes a quiz, the system only reads pre-approved `QuestionBankItem` rows. Zero AI calls on the student-facing request path.
3. **Blind re-check pipeline.** Every AI-generated question is checked twice: the generation call, then an independent second AI call that reviews it for correctness/ambiguity. A question is `APPROVED` only after passing re-check or explicit manual teacher approval.
4. **Question snapshot at attempt start.** When a student starts an attempt, snapshot the drawn questions (content + correct answers, with CALCULATION variables already rolled) into `StudentAttempt.questionSnapshot` / `StudentAnswer.correctAnswerSnapshot`. Grading and review always read the snapshot, never live-join back to `QuestionBankItem`.
5. **Post-publish content lock.** Once a quiz is `PUBLISHED`, its `QuestionBankItem` content is immutable. The teacher may only *extend* the deadline (never shorten it); time limit and question content stay fixed. Any question fix applies only to attempts started afterward, never retroactively.

## Workflow for the agent

- Turn on Plan Mode for anything touching more than one file, or one API route plus one Prisma model.
- Before editing schema, API routes, or AI-calling code, check for a matching `.cursor/rules/*.mdc` file — those carry glob-scoped detail this file intentionally omits.
- Prefer the smallest change that still satisfies the five decisions above over a more "elegant" rewrite.
- Build in vertical slices: a feature is done when its full path (UI → API route → service → Prisma → back to UI) works end to end, not when one layer looks complete. Build order is in `docs/PRD.md` §10.
- Any Prisma schema change: update `prisma/schema.prisma` → `npx prisma migrate dev` → update the TypeScript interfaces that mirror `Json` fields (`docs/ARCHITECTURE.md`).
- Any Gemini call: go through the `callGeminiForJSON<T>` adapter (`docs/ARCHITECTURE.md`) — never call the API directly from a route handler or component.

## Where to look for what

| Need | Doc |
|---|---|
| Full feature behavior, screens, entities, locked decisions | `docs/PRD.md` |
| Folder structure, design patterns, `Json` field shapes | `docs/ARCHITECTURE.md` |
| Data model | `prisma/schema.prisma` |
