/**
 * Question Bank Generation Chat Prompts
 * Two-phase approach: Generate questions with user confirmation
 */

export interface QuestionGenerationConfig {
  count: number;
  questionTypes: ("MCQ" | "SHORT_ANSWER" | "CALCULATION")[];
  difficulty: "easy" | "medium" | "hard";
  customInstructions?: string;
}

export interface QuestionProposal {
  type: "MCQ" | "SHORT_ANSWER" | "CALCULATION";
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

export interface GenerationPlan {
  count: number;
  questionTypes: string[];
  difficulty: string;
  customInstructions?: string;
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

Please greet the user and ask about their question generation preferences:
1. How many questions they want
2. What question types (MCQ, Short Answer, Calculation)
3. What difficulty level (easy, medium, hard)
4. Any specific topics or areas to focus on

Return your response as JSON:
\`\`\`json
{
  "message": "Your greeting and initial questions to the user",
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
 * Generate questions based on configuration
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

## Output Format:
Return a JSON object with your questions:
\`\`\`json
{
  "message": "Confirmation message summarizing what was generated",
  "questions": [
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
      "promptTemplate": "A store sells {num_items} items at {price_per_item} dollars each. What is the total cost?",
      "variables": [
        {"name": "num_items", "min": 1, "max": 10, "decimals": 0},
        {"name": "price_per_item", "min": 10, "max": 100, "decimals": 2}
      ],
      "answerFormula": "num_items * price_per_item",
      "explanation": "Multiply number of items by price per item"
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

Analyze the user's request and either:
1. Update the plan based on their feedback
2. Confirm you're ready to generate with the new settings

Return as JSON:
\`\`\`json
{
  "message": "Your response to the user",
  "updatedPlan": { updated plan or null if no change },
  "readyToGenerate": true/false
}
\`\`\``;
}
