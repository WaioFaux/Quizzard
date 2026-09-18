# Quizzard Documentation

This directory contains all design and specification documents for the Quizzard project.

## Implementation Status

All five vertical slices from the build order (PRD §10) are **functionally complete**.

| Feature | Status | Notes |
|---|---|---|
| Auth (signup / login / logout) | Implemented | iron-session, bcrypt password hashing |
| Class management (create / join) | Implemented | Class code + password enrollment |
| Material upload + PDF extraction | Implemented | `pdf-parse`, PROCESSING → PROCESSED status |
| Quiz configuration + publish | Implemented | DRAFT → PUBLISHED state machine |
| AI question generation + blind re-check | Implemented | Gemini API via `callGeminiForJSON`, independent re-check per question |
| Question bank (approve / flag / edit / delete) | Implemented | Manual approval, status transitions |
| CSV / XLSX import + export | Implemented | `/api/quizzes/:id/question-bank/upload` and `/export` |
| Quiz attempt with snapshot + grading | Implemented | Question frozen at start, CALCULATION random rolling |
| Deadline + time limit enforcement | Implemented | Server-side validation, client-side countdown |
| Student results + report questions | Implemented | Per-question correct/incorrect, explanation, report button |
| Class-specific leaderboards | Implemented | Per-class, per-quiz, podium + rankings |
| Student progress tracker | Implemented | `/student/progress` — completed/available quizzes, stats |
| Teacher analytics dashboard | Implemented | Per-class stats, recent submissions, leaderboard tabs |
| Per-class / per-quiz leaderboards for teachers | Implemented | In analytics page, two-step class → quiz selection |
| Teacher reports inbox (UI) | Not implemented | API route exists (`GET /api/reports`); no dedicated page yet |
| AI lecture proposal from material | Not implemented | Materials are uploaded directly; lecture creation is manual |
| Prisma seed script | Not implemented | `prisma/seed.ts` does not exist |
| "Generate more" questions (UI) | Not implemented | API route supports count + instructions; no UI button yet |

## Document Index

| Document | Purpose |
|---|---|
| [PRD.md](./PRD.md) | Product requirements: features, user flows, locked decisions, entity definitions, build order |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture: folder structure, design patterns, `Json` field shapes, coding conventions, service layer, error handling, auth middleware, validation, logging |
| [AGENTS.md](./AGENTS.md) | Agent instructions: what this project is, tech stack constraints, five non-negotiable design decisions, workflow guidelines |
| [SECURITY.md](./SECURITY.md) | Security plan: authentication, session management, RBAC, input validation, file upload security, API rate limiting, AI security, data privacy, error handling, pre-production checklist |
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | System design: full tech stack, env vars, database conventions, full folder structure, API design, quiz attempt sequence, AI pipeline, error handling, logging, testing strategy, deployment guide, performance & scalability |

## Quick Reference

### Five Non-Negotiable Design Decisions
1. **Fixed Question Bank pool** — one AI-generated pool, students draw random subsets
2. **No AI calls at quiz time** — zero AI calls on student-facing request path
3. **Blind re-check pipeline** — independent second AI call per generated question
4. **Question snapshot at attempt start** — content frozen at start, never live-joined to bank
5. **Post-publish content lock** — published quiz bank is immutable; only deadline extension allowed

### State Machines
- `QuizStatus`: `DRAFT → PUBLISHED` (one-way)
- `QuestionStatus`: `DRAFT → FLAGGED_FOR_REVIEW → APPROVED` or `DRAFT → APPROVED`
- `AttemptStatus`: `IN_PROGRESS → SUBMITTED` | `AUTO_SUBMITTED`

### Build Order (Vertical Slices)
1. Core loop (upload → configure → preview → generate → publish → take quiz → leaderboard)
2. Deadline enforcement
3. Time limit + auto-submit
4. Multiple classes
5. Class join flow

### Question Types
- **MCQ** — multiple choice with shuffled options per student
- **SHORT_ANSWER** — free text answer, compared case-insensitively
- **CALCULATION** — numeric answer with variables rolled per student, formula evaluated with `mathjs`
