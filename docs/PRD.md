# PRD.md — Quizzard Product Specification

Source of truth for what the app does. Cross-reference `AGENTS.md` for the non-negotiable rules that override any local interpretation of this doc.

## 1. Product summary

A teacher turns a lecture into a quiz by giving the AI instructions (topic focus, difficulty, question count), previewing a few sample questions, iterating on the instructions, then approving and publishing a full question pool. Each student who takes the quiz gets a randomized subset of that pool with shuffled question and answer order, so no two students see an identical paper — without the unfairness of every student facing objectively different questions.

## 2. Terminology

| Term | Meaning |
|---|---|
| Class | One teacher's group of students. Has a unique `classCode` + `classPassword` students use to join. |
| Lecture | One unit of course content (e.g. "Session 3 – Database Normalization"). Exactly one quiz belongs to a lecture. |
| Quiz | The assessment tied to a lecture. Has its own deadline and time limit. |
| Question Bank | The fixed pool of AI-generated questions for one quiz. Default size = 5× the per-attempt question count. |
| Attempt | One student's single try at one quiz. **MVP: exactly one attempt per student per quiz.** |
| Deadline | Last moment a student may *start* an attempt. |
| Time limit | Minutes a student has once they *start* an attempt — independent of the deadline. |

## 3. Roles

- **Teacher**: creates classes, uploads materials, configures/approves/publishes quizzes, reviews reported questions.
- **Student**: joins classes, takes quizzes, views results and the leaderboard, reports bad questions.
- Each account has exactly one fixed role, chosen at signup. No admin role, no OAuth, no email verification, no password reset — auth stays minimal by design.

## 4. Auth flow

1. **Sign up**: name, email/username, password, role (teacher/student).
2. **Log in**: email/username + password → iron-session cookie.
3. Post-login redirect by role: teacher → "My Classes" dashboard, student → "My Enrolled Classes" dashboard.

## 5. Teacher flow

### 5.1 Create a class
- Teacher enters a class name (+ optional description).
- System generates a unique `classCode`; teacher sets or auto-generates a `classPassword`.
- Both are editable any time from the class dashboard.

### 5.2 Upload course material
- Inside a class → "Upload material" → PDF only, multiple files allowed per class (courses are often split by session).
- Show processing state: `PROCESSING` → `PROCESSED` (or `FAILED`).

### 5.3 AI-proposed lecture structure
- After a material finishes processing, AI analyzes it and proposes a list of **Lectures**, each linked to a page/chapter range in the source (`sourceRef`) so later question generation has a traceable source.
- Teacher can: rename, merge/split, delete, or manually add a lecture.
- On confirmation, the system creates one `DRAFT` quiz per lecture.

### 5.4 Configure quiz
Per lecture, the teacher sets:
- AI instructions (focus content, question type mix: MCQ / short-answer / calculation, difficulty)
- Questions per attempt (the per-student draw size, not the pool size)
- Time limit (minutes)
- Deadline (can be set now or deferred to the publish step, §5.7)

### 5.5 Sample preview loop
- "Generate sample" → AI returns 3–5 example questions from the current instructions.
- Not satisfied → edit instructions (§5.4) → regenerate. Repeat freely.
- This step exists specifically so instructions get dialed in before spending quota on a full pool.

### 5.6 Generate & approve the Question Bank
- "Generate full Question Bank" → AI generates the fixed pool (default 5× the per-attempt count).
- For CALCULATION questions: AI generates a formula/variable template (e.g. variables `a`, `b` random within range X, answer = `f(a, b)`) — the non-numeric parts of the question stay fixed.
- Every generated question runs through **blind re-check**: a second, independent AI call reviews it for correctness/ambiguity/formula errors and sets its status:
  - `DRAFT` — just generated, not yet re-checked
  - `FLAGGED_FOR_REVIEW` — re-check found a problem
  - `APPROVED` — passed re-check, or manually approved by the teacher
- Question Bank screen: all questions, `FLAGGED_FOR_REVIEW` sorted to the top.
- Teacher can: edit content/answer, delete a question, add manual questions, click "Generate more" (own count + own instructions, which may target a different sub-topic/difficulty than the original), or upload a bank file (CSV/Excel: `question, type, options, correct_answer, explanation`) to append or replace — uploaded rows are used verbatim, no AI processing.
- "Generate more" appends to the existing pool without duplicating existing questions, and the new items also go through blind re-check.
- **AI never paraphrases or silently rewrites an existing bank question.** Every question (except a CALCULATION question's per-student rolled numbers) is fixed content, identical for every student who draws it.

### 5.7 Approve & publish
- Once every bank question is `APPROVED` (or the teacher explicitly overrides a flag), the teacher confirms the deadline and clicks "Publish."
- Quiz status: `DRAFT` → `PUBLISHED`. Enrolled students can now see it.
- **Post-publish lock**: bank content becomes immutable, even before any student submits. The teacher may only *extend* the deadline (never shorten it); time limit and question content stay fixed. Any question fix applies only to attempts started after the fix, never retroactively.

### 5.8 Post-publish monitoring
- Leaderboard per quiz and per class total.
- List of students who: completed / haven't started / missed the deadline without starting.
- List of student-submitted question reports (§6.5) for the teacher to act on (fix for future attempts, or waive points for that question).

## 6. Student flow

### 6.1 Sign up / log in
As in §4.

### 6.2 Join a class
- "Join class" → enter `classCode` + `classPassword` → class appears under "My Classes."

### 6.3 View quizzes
Per lecture: title, deadline, time limit, status (not started / completed / missed deadline).

### 6.4 Take a quiz
- "Start attempt" is only enabled if the deadline hasn't passed and the student has no prior attempt on this quiz.
- On start, the system draws the configured number of questions at random from the `APPROVED` pool, shuffles question order and each question's answer order (seeded per student, no AI call involved), and rolls fresh numbers for any CALCULATION question for this student.
- Countdown timer shown for the configured time limit; auto-submits on expiry. The client-side countdown is advisory only — the server independently validates elapsed time against `startedAt` when the submission is received.
- If a student starts right before the deadline, they still get the *full* configured time limit even if it runs past the deadline.

### 6.5 View results
- Score, per-question correct/incorrect (with correct answer + explanation if available).
- "Report a problem" button per question → sends a report to the teacher (§5.8).

### 6.6 Leaderboard
- Student's rank vs. the rest of the class. **Real names shown — not anonymized.**

## 7. Locked decisions (do not revisit without explicit instruction)

| # | Question | Decision |
|---|---|---|
| 1 | Is the Question Bank a template or a fixed pool? | **Fixed pool.** CALCULATION questions roll random numbers + compute the answer by formula; everything else is fixed content for every student. |
| 2 | Does AI paraphrase bank questions after generation? | **No.** |
| 3 | Real names or anonymous on the leaderboard? | **Real names.** |
| 4 | What can a teacher edit post-publish? | **Deadline extension only.** No content edits/deletes on published bank items, no deadline shortening. |
| 5 | How much bigger should the pool be than the per-attempt draw? | **5× by default.** Teacher can generate more at any time via "Generate more" (custom count/instructions). |
| 6 | Attempts per student per quiz | **Exactly one in MVP.** |

## 8. State machines

**QuizStatus**: `DRAFT → PUBLISHED` (one-way; no un-publish).

**QuestionStatus**: `DRAFT → FLAGGED_FOR_REVIEW → APPROVED`, or `DRAFT → APPROVED` directly if re-check passes clean. Teacher manual approval can also move `FLAGGED_FOR_REVIEW → APPROVED`.

**AttemptStatus**: `IN_PROGRESS → SUBMITTED` (student-initiated) or `IN_PROGRESS → AUTO_SUBMITTED` (timer expiry).

Enforce all three through a single transition function per entity — never set `status` directly from a route handler. See `docs/ARCHITECTURE.md` §3.

## 9. Entities

`User, Class, Enrollment, Material, Lecture, Quiz, QuestionBankItem, StudentAttempt, StudentAnswer, QuestionReport`

Authoritative shape: `prisma/schema.prisma`. `Json` field contracts: `docs/ARCHITECTURE.md`.

## 10. Build order

Vertical slices — each one is a complete, runnable path before moving to the next.

1. **Slice 1 — Core loop.** Upload material → configure quiz → sample preview → generate & approve bank → publish → student takes quiz (no deadline/time limit enforcement yet) → leaderboard. Single class only.
2. **Slice 2 — Deadline.** Enforce quiz deadline on attempt start.
3. **Slice 3 — Time limit.** Countdown timer + server-side elapsed-time enforcement + auto-submit.
4. **Slice 4 — Multiple classes.** Teacher manages more than one class, each with its own leaderboard.
5. **Slice 5 — Class join flow.** Student self-enrollment via class code + password. (May need to land earlier than Slice 4 in practice for testability — confirm before deferring.)
