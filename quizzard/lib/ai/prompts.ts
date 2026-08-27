import type { QuestionType } from "@prisma/client";

export interface PromptContext {
  topic: string;
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
  questionTypes?: QuestionType[];
  existingQuestions?: string[];
  materialText?: string;
}

export interface GeneratedPrompt {
  type: "MCQ" | "SHORT_ANSWER" | "CALCULATION";
  prompt?: string;
  promptTemplate?: string;
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string;
  variables?: Array<{
    name: string;
    min: number;
    max: number;
    decimals?: number;
  }>;
  answerFormula?: string;
  explanation?: string;
}

export interface RecheckResult {
  flagged: boolean;
  reason?: string;
  suggestion?: string;
}

export interface LectureProposal {
  title: string;
  startPage: number;
  endPage: number;
}

export function generateQuestionsPrompt(ctx: PromptContext): string {
  const count = ctx.count ?? 5;
  const typeList =
    ctx.questionTypes && ctx.questionTypes.length > 0
      ? ctx.questionTypes.join(", ")
      : "MCQ, SHORT_ANSWER, CALCULATION";

  const difficulty = ctx.difficulty ?? "medium";
  const existingList =
    ctx.existingQuestions && ctx.existingQuestions.length > 0
      ? `\n\nExisting questions (do not duplicate):\n${ctx.existingQuestions.map((q) => `  - ${q}`).join("\n")}`
      : "";

  const materialSection = ctx.materialText
    ? `\n\nUse the following material as context for generating accurate questions:\n${ctx.materialText}`
    : "";

  return `You are a quiz question generator for educational content. Your task is to generate ${count} diverse, high-quality questions based on the given topic and context.

Topic: ${ctx.topic}
Difficulty: ${difficulty}
Question types to generate: ${typeList}${materialSection}${existingList}

## Requirements for Each Question Type:

### MCQ (Multiple Choice Questions)
- Create exactly 4 distinct options (A, B, C, D)
- One option must be clearly correct, others plausible but wrong
- Avoid "all of the above" or "none of the above" options
- The prompt should not reveal the answer
- Include a brief explanation for the correct answer

### SHORT_ANSWER Questions
- Require a concise, single correct answer (1-3 sentences)
- The answer should be unambiguous and objectively verifiable
- Include an optional explanation

### CALCULATION Questions
- Include a promptTemplate with variable placeholders like {variableName}
- Define variables with name, min, max, and optional decimals
- Provide a mathematically valid answerFormula using variable names
- Include an explanation of the calculation approach

## Output Format:
Return a JSON array of ${count} question objects. Each object must match exactly one of these shapes:

\`\`\`json
[
  {
    "type": "MCQ",
    "prompt": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 0,
    "explanation": "Why this is correct"
  },
  {
    "type": "SHORT_ANSWER",
    "prompt": "Question text here",
    "correctAnswer": "The correct answer",
    "explanation": "Optional explanation"
  },
  {
    "type": "CALCULATION",
    "promptTemplate": "A {item} costs ${price}. With {tax_rate}% tax, what is the total?",
    "variables": [
      {"name": "item", "min": 1, "max": 10, "decimals": 0},
      {"name": "price", "min": 10, "max": 100, "decimals": 2},
      {"name": "tax_rate", "min": 5, "max": 15, "decimals": 1}
    ],
    "answerFormula": "(price * item) * (1 + tax_rate / 100)",
    "explanation": "Calculate subtotal, then add tax percentage"
  }
]
\`\`\`

Return ONLY the JSON array, no additional text or explanation.`;
}

export function recheckQuestionPrompt(question: object): string {
  return `You are a quality assurance reviewer for educational quiz questions. Carefully examine the question below for any issues.

Question to review:
\`\`\`json
${JSON.stringify(question, null, 2)}
\`\`\`

## Review Checklist:
1. **Factual Accuracy**: Is the question content factually correct?
2. **Clarity**: Is the question clear and unambiguous?
3. **Correct Answer Validity**: Is the correct answer actually correct?
4. **Option Quality** (for MCQ): Are all options plausible and relevant?
5. **Formula Validity** (for CALCULATION): Does the formula produce correct results?
6. **Appropriate Difficulty**: Is the question appropriate for the intended audience?
7. **No Answer Leakage**: Does the question text avoid revealing the answer?

## Response Format:
Return a JSON object with your assessment:
\`\`\`json
{
  "flagged": true or false,
  "reason": "If flagged, explain the specific issue(s) found",
  "suggestion": "If flagged, provide a suggested correction"
}
\`\`\`

Return ONLY the JSON object, no additional text.`;
}

export function proposeLecturesPrompt(materialText: string): string {
  return `Analyze the following educational material and propose a logical division of lectures/sessions.

Source Material:
\`\`\`
${materialText}
\`\`\`

## Guidelines for Lecture Division:
- Each lecture should cover a distinct, coherent topic or chapter
- Lectures should have descriptive titles (max 100 characters)
- Reference approximate page ranges where content shifts to a new topic
- Consider the natural flow and progression of concepts
- Balance lecture lengths (avoid extremely short or long lectures)

## Response Format:
Return a JSON array of lecture proposals:
\`\`\`json
[
  {
    "title": "Introduction to Database Concepts",
    "startPage": 1,
    "endPage": 10
  },
  {
    "title": "Relational Data Modeling",
    "startPage": 11,
    "endPage": 25
  }
]
\`\`\`

Return ONLY the JSON array, no additional text or explanation.`;
}

export function buildGradingPrompt(
  question: object,
  studentAnswer: string
): string {
  return `You are an AI grading assistant. Evaluate the student's answer against the question and correct answer.

Question:
\`\`\`json
${JSON.stringify(question, null, 2)}
\`\`\`

Student's Answer:
${studentAnswer}

## Grading Guidelines:
- Compare the student's answer to the expected correct answer
- For SHORT_ANSWER: Check if key elements are present (partial credit allowed)
- For CALCULATION: Verify the mathematical result and methodology

## Response Format:
\`\`\`json
{
  "score": <number between 0 and maxScore>,
  "maxScore": <maximum possible score>,
  "feedback": "Brief explanation of the grade and what was correct/incorrect"
}
\`\`\`

Return ONLY the JSON object, no additional text.`;
}
