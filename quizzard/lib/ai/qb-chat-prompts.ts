/**
 * Question Bank Generation Chat Prompts
 * Two-phase approach: Generate questions with user confirmation
 */
import { VIETNAMESE_OUTPUT_RULE } from "./language";

export type QuestionType = "MCQ" | "SHORT_ANSWER" | "CALCULATION";
export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * How much of the lecture material is put into a generation prompt.
 *
 * The excerpt is the biggest lever on the model's latency: the failing
 * runs sent 10 000 characters of material into every prompt and the
 * "hard" buckets regularly needed more than 37s to answer, which is
 * more than one serverless request can wait for. A shorter excerpt
 * keeps the model inside the request budget.
 */
export const MATERIAL_EXCERPT_CHARS = 4000;

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface TypeConfig {
  enabled: boolean;
  count: number;
  distribution: DifficultyDistribution; // easy + medium + hard must equal count
}

export interface GenerationPlan {
  MCQ: TypeConfig;
  SHORT_ANSWER: TypeConfig;
  CALCULATION: TypeConfig;
  customInstructions?: string;
}

export interface QuestionGenerationConfig {
  count: number;
  questionTypes: QuestionType[];
  difficulty: DifficultyLevel;
  customInstructions?: string;
}

export interface QuestionProposal {
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  correctAnswer?: string;
  promptTemplate?: string;
  variables?: Array<{
    name: string;
    min: number;
    max: number;
    decimals?: number;
  }>;
  answerFormula?: string;
  explanation?: string;
}

export interface GenerationResult {
  message: string;
  questions: QuestionProposal[];
  plan: GenerationPlan;
}

/**
 * System prompt for the question generation assistant
 */
export const QB_CHAT_SYSTEM_PROMPT = `You are an AI assistant for generating quiz questions.

${VIETNAMESE_OUTPUT_RULE}

Guidelines:
- Help users configure question generation settings
- Explain what each option means
- Generate questions based on user's specifications
- When user confirms, generate the requested questions
- Use the exact JSON format specified
- Do not make up facts not present in the material

Question Types:
- MCQ: Multiple choice with 4 options
- SHORT_ANSWER: Open-ended questions with concise answers
- CALCULATION: Math/physics problems with variable substitution

Difficulty Levels:
- easy: Basic recall and understanding
- medium: Application and analysis
- hard: Synthesis and evaluation`;

/**
 * Initial greeting and configuration prompt
 */
export function getInitialConfigPrompt(
  topic: string,
  existingQuestions: string[] = [],
  materialText?: string
): string {
  const existingList = existingQuestions.length > 0
    ? `\n\nExisting questions in the bank (do not duplicate):\n${existingQuestions.map((q) => `  - ${q}`).join("\n")}`
    : "";

  const materialSection = materialText
    ? `\n\nUse this material as context:\n${materialText.slice(0, 10000)}${materialText.length > 10000 ? "\n\n[... content truncated ...]" : ""}`
    : "";

  return `You are helping configure question generation for: "${topic}"${existingList}${materialSection}

${VIETNAMESE_OUTPUT_RULE}

Please greet the user and ask about their question generation preferences:
1. How many questions they want
2. What question types (MCQ, Short Answer, Calculation)
3. What difficulty level (easy, medium, hard)
4. Any specific topics or areas to focus on

Return your response as JSON:
\`\`\`json
{
  "message": "Lời chào và các câu hỏi ban đầu cho người dùng",
  "suggestions": {
    "count": 10,
    "questionTypes": ["MCQ", "SHORT_ANSWER"],
    "difficulty": "medium"
  },
  "awaitingConfig": true
}
\`\`\``;
}

/**
 * Generate questions based on configuration (legacy flat config)
 */
export function getGenerationPrompt(
  topic: string,
  config: QuestionGenerationConfig,
  materialText?: string
): string {
  const typeList = config.questionTypes.join(", ");
  const materialSection = materialText
    ? `\n\nUse this material as context:\n${materialText.slice(0, 12000)}${materialText.length > 12000 ? "\n\n[... content truncated ...]" : ""}`
    : "";

  return `Generate ${config.count} questions based on the following configuration:

Topic: ${topic}
Count: ${config.count}
Question Types: ${typeList}
Difficulty: ${config.difficulty}${config.customInstructions ? `\nCustom Instructions: ${config.customInstructions}` : ""}${materialSection}

${VIETNAMESE_OUTPUT_RULE}

## Output Format:
Return a JSON object with your questions:
\`\`\`json
{
  "message": "Thông báo xác nhận tóm tắt những gì đã được tạo",
  "questions": [
    {
      "type": "MCQ",
      "prompt": "Nội dung câu hỏi",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctOptionIndex": 0,
      "explanation": "Giải thích vì sao đáp án này đúng"
    },
    {
      "type": "SHORT_ANSWER",
      "prompt": "Nội dung câu hỏi",
      "correctAnswer": "Đáp án đúng",
      "explanation": "Giải thích (không bắt buộc)"
    },
    {
      "type": "CALCULATION",
      "promptTemplate": "Một cửa hàng bán {num_items} món với giá {price_per_item} đồng mỗi món. Tổng chi phí là bao nhiêu?",
      "variables": [
        {"name": "num_items", "min": 1, "max": 10, "decimals": 0},
        {"name": "price_per_item", "min": 10, "max": 100, "decimals": 2}
      ],
      "answerFormula": "num_items * price_per_item",
      "explanation": "Nhân số lượng món với giá của mỗi món"
    }
  ]
}
\`\`\`

Requirements:
- MCQ requires exactly 4 distinct options
- SHORT_ANSWER requires a concise, verifiable answer
- CALCULATION requires valid formula and variables
- All questions should match the specified difficulty
- Return ONLY the JSON, no additional text`;
}

/**
 * Generate questions for a specific type and difficulty bucket.
 * Used when the plan has per-type and per-difficulty configuration.
 */
export function getTypeDifficultyPrompt(
  topic: string,
  questionType: QuestionType,
  difficulty: DifficultyLevel,
  count: number,
  customInstructions?: string,
  materialText?: string
): string {
  const difficultyDesc: Record<DifficultyLevel, string> = {
    easy: "Basic recall and understanding — straightforward questions testing fundamental knowledge",
    medium: "Application and analysis — questions requiring applying concepts to new situations",
    hard: "Synthesis and evaluation — complex questions requiring deeper reasoning and analysis",
  };

  const typeDesc: Record<QuestionType, string> = {
    MCQ: "Multiple choice questions with 4 distinct options (A, B, C, D). One correct answer.",
    SHORT_ANSWER: "Open-ended questions with a concise, verifiable correct answer.",
    CALCULATION: "Math or physics problems with variable substitution. Include a promptTemplate with {variable} placeholders, a variables array defining min/max/decimals, and an answerFormula.",
  };

  const materialSection = materialText
    ? `\n\nUse this material as context:\n${materialText.slice(0, MATERIAL_EXCERPT_CHARS)}${materialText.length > MATERIAL_EXCERPT_CHARS ? "\n\n[... content truncated ...]" : ""}`
    : "";

  const mcqOutput = `    {
      "type": "${questionType}",
      "prompt": "Nội dung câu hỏi",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctOptionIndex": 0,
      "explanation": "Giải thích vì sao đáp án này đúng"
    }`;

  const shortAnswerOutput = `    {
      "type": "${questionType}",
      "prompt": "Question text here",
      "correctAnswer": "The correct answer",
      "explanation": "Optional explanation"
    }`;

  const calcOutput = `    {
      "type": "${questionType}",
      "promptTemplate": "Một cửa hàng bán {num_items} món với giá {price_per_item} đồng mỗi món. Tổng chi phí là bao nhiêu?",
      "variables": [
        {"name": "num_items", "min": 1, "max": 10, "decimals": 0},
        {"name": "price_per_item", "min": 10, "max": 100, "decimals": 2}
      ],
      "answerFormula": "num_items * price_per_item",
      "explanation": "Giải thích từng bước"
    }`;

  const questionsBlock =
    questionType === "MCQ"
      ? mcqOutput
      : questionType === "SHORT_ANSWER"
      ? shortAnswerOutput
      : calcOutput;

  const typeRequirements =
    questionType === "MCQ"
      ? "Exactly 4 distinct, plausible options. The wrong options should be plausible distractors."
      : questionType === "SHORT_ANSWER"
      ? "The answer must be concise and verifiable against the material."
      : "Variables must be numeric. The formula must use the exact variable names defined.";

  return `Generate ${count} ${difficulty} ${questionType} question(s) for the topic: "${topic}"${customInstructions ? `\nCustom instructions: ${customInstructions}` : ""}${materialSection}

${VIETNAMESE_OUTPUT_RULE}

## Question Type: ${questionType}
${typeDesc[questionType]}

## Difficulty: ${difficulty}
${difficultyDesc[difficulty]}

## Output Format:
Return a JSON object:
\`\`\`json
{
  "questions": [
${questionsBlock}
  ]
}
\`\`\`

Requirements:
- Generate exactly ${count} question(s) at ${difficulty} difficulty
- ${typeRequirements}
- Questions must genuinely be ${difficulty} difficulty
- Return ONLY the JSON, no additional text`;
}

/**
 * Prompt for adjusting or regenerating questions
 */
export function getAdjustPrompt(
  currentPlan: GenerationPlan,
  userMessage: string
): string {
  const planJson = JSON.stringify(currentPlan, null, 2);

  return `The user wants to adjust the question generation:

Current Plan:
\`\`\`json
${planJson}
\`\`\`

User's request: "${userMessage}"

${VIETNAMESE_OUTPUT_RULE}

Analyze the user's request and either:
1. Update the plan based on their feedback
2. Confirm you're ready to generate with the new settings

Return as JSON:
\`\`\`json
{
  "message": "Câu trả lời của bạn cho người dùng",
  "updatedPlan": { updated plan or null if no change },
  "readyToGenerate": true/false
}
\`\`\``;
}
