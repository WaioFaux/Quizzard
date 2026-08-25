import type { QuestionType } from "@prisma/client";

export interface PromptContext {
  topic: string;
  difficulty?: "easy" | "medium" | "hard";
  questionTypes?: QuestionType[];
  existingQuestions?: string[];
  materialText?: string;
}

export function buildGenerationPrompt(ctx: PromptContext): string {
  const typeList =
    ctx.questionTypes && ctx.questionTypes.length > 0
      ? ctx.questionTypes.join(", ")
      : "MCQ, SHORT_ANSWER, ESSAY, CALCULATION";

  const difficulty = ctx.difficulty ?? "medium";
  const existingList =
    ctx.existingQuestions && ctx.existingQuestions.length > 0
      ? `\n\nExisting questions (do not duplicate):\n${ctx.existingQuestions.map((q) => `  - ${q}`).join("\n")}`
      : "";

  const materialSection = ctx.materialText
    ? `\n\nUse the following material as context:\n${ctx.materialText}`
    : "";

  return `You are a quiz question generator for educational content.

Generate questions about: ${ctx.topic}
Difficulty: ${difficulty}
Question types to include: ${typeList}${materialSection}${existingList}

Requirements:
- Each question must be factually accurate and relevant to the topic.
- MCQ questions must have exactly 4 options with one clearly correct answer.
- SHORT_ANSWER questions must have a single, unambiguous correct answer.
- ESSAY questions must have a clear rubric for grading.
- CALCULATION questions must include variable ranges and a formula.
- Avoid questions that overlap with existing questions.
- Do not include the correct answer in the question text.

Output format: Return a JSON array of question objects matching these shapes:

MCQ: { "type": "MCQ", "prompt": "...", "options": ["A", "B", "C", "D"], "correctOptionIndex": 0, "explanation": "..." }
SHORT_ANSWER: { "type": "SHORT_ANSWER", "prompt": "...", "correctAnswer": "...", "explanation": "..." }
ESSAY: { "type": "ESSAY", "prompt": "...", "rubric": "..." }
CALCULATION: { "type": "CALCULATION", "promptTemplate": "...", "variables": [{ "name": "x", "min": 1, "max": 10, "decimals": 0 }], "answerFormula": "x * 2", "explanation": "..." }

Return ONLY the JSON array, no additional text.`;
}

export function buildSamplePrompt(ctx: PromptContext): string {
  return buildGenerationPrompt({ ...ctx, questionTypes: ctx.questionTypes ?? ["MCQ", "SHORT_ANSWER"] });
}

export function buildRecheckPrompt(question: object): string {
  return `Review the following quiz question for correctness, clarity, and absence of ambiguity.

Question: ${JSON.stringify(question, null, 2)}

Check for:
1. Factual accuracy of the content
2. Clarity of the question prompt
3. Validity of the correct answer
4. Appropriateness of options (for MCQ)
5. Validity of the formula (for CALCULATION)
6. Potential confusion points or ambiguous wording

Respond with a JSON object:
{ "flagged": true/false, "reason": "explanation if flagged", "suggestion": "optional correction" }`;
}

export function buildLectureProposalPrompt(materialText: string): string {
  return `Analyze the following educational material and propose a list of lectures/sessions.

Material:
${materialText}

Based on the content, propose a list of logical lecture divisions. Each lecture should:
- Cover a distinct topic or chapter
- Have a descriptive title (max 100 characters)
- Reference the approximate page range in the source material

Respond with a JSON array:
[{ "title": "Lecture Title", "startPage": 1, "endPage": 10 }]

Return ONLY the JSON array, no additional text.`;
}
