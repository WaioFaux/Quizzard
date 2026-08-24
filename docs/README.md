# Quizzard Documentation

This directory contains all design and specification documents for the Quizzard project.

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
