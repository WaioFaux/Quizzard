/**
 * Two-phase chat prompts for AI lecture generation.
 * Phase 1: Analyze document and propose lecture structure
 * Phase 2: Generate valid lecture format when user confirms
 */
import { VIETNAMESE_OUTPUT_RULE } from "./language";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LectureProposal {
  title: string;
  startPage: number;
  endPage: number;
  description?: string;
}

export interface LectureFormat {
  title: string;
  sourceRef: {
    startPage: number;
    endPage: number;
  };
  quiz?: {
    instructions: string;
    questionCount: number;
  };
}

/**
 * Phase 1: Initial greeting and document analysis prompt
 */
export function getInitialAnalysisPrompt(materialText: string): string {
  return `You are an AI teaching assistant helping to organize educational content into lectures.

I will provide you with extracted text from an educational document. Your task is to:

1. Analyze the content and understand the overall structure
2. Identify natural divisions/chapters/topics
3. Propose a logical lecture structure

## Guidelines:
- Each lecture should cover a distinct, coherent topic
- Lecture titles should be descriptive and clear (max 100 characters)
- Reference page ranges where content shifts to a new topic
- Consider the natural flow and progression of concepts
- Balance lecture lengths (aim for 5-10 lectures depending on content volume)
- Provide a brief description for each proposed lecture

## Document Content:
\`\`\`
${materialText.slice(0, 15000)}${materialText.length > 15000 ? "\n\n[... content truncated ...]" : ""}
\`\`\`

${VIETNAMESE_OUTPUT_RULE}

Please analyze this document and propose a lecture structure. Return your response as a JSON array with the following format:

\`\`\`json
{
  "message": "Phân tích và lời chào của bạn dành cho người dùng",
  "proposals": [
    {
      "title": "Tiêu đề buổi giảng",
      "startPage": 1,
      "endPage": 10,
      "description": "Mô tả ngắn gọn các chủ đề được đề cập"
    }
  ],
  "readyToConfirm": true
}
\`\`\`

The "readyToConfirm" field indicates whether you're ready for the user to confirm the plan. Set it to true when you've presented your proposals.`;
}

/**
 * Phase 1: Follow-up analysis when user asks questions or requests changes
 */
export function getFollowUpPrompt(
  currentProposals: LectureProposal[],
  userMessage: string
): string {
  const proposalsJson = JSON.stringify(currentProposals, null, 2);

  return `The user has asked: "${userMessage}"

Current lecture proposals:
\`\`\`json
${proposalsJson}
\`\`\`

${VIETNAMESE_OUTPUT_RULE}

Please respond to the user's message while considering the current proposals. 
If they're asking to modify proposals, update them accordingly.
If they're asking questions, answer helpfully.
If they want to confirm, tell them to use the "Xác nhận kế hoạch" button.

Return your response as:
\`\`\`json
{
  "message": "Câu trả lời của bạn cho người dùng",
  "proposals": [updated proposals if changed, otherwise keep as is],
  "readyToConfirm": true/false
}
\`\`\``;
}

/**
 * Phase 2: Generate valid lecture format when user confirms
 */
export function getConfirmPrompt(confirmedProposals: LectureProposal[]): string {
  const proposalsJson = JSON.stringify(confirmedProposals, null, 2);

  return `The user has confirmed the following lecture plan:
\`\`\`json
${proposalsJson}
\`\`\`

${VIETNAMESE_OUTPUT_RULE}

Now generate the final lecture data in the exact format needed for database insertion:

\`\`\`json
{
  "message": "Thông báo xác nhận hiển thị cho người dùng",
  "lectures": [
    {
      "title": "Tiêu đề buổi giảng",
      "sourceRef": {
        "startPage": 1,
        "endPage": 10
      },
      "quiz": {
        "instructions": "Tạo câu hỏi bao gồm: [tóm tắt chủ đề ngắn gọn]",
        "questionCount": 5
      }
    }
  ]
}
\`\`\`

Requirements:
- Each lecture must have a unique title
- sourceRef must include startPage and endPage
- quiz.instructions should be specific to the lecture topic
- quiz.questionCount can vary based on lecture length (3-10 recommended)
- Return ONLY the JSON, no additional text`;
}

/**
 * System prompt for the chat assistant
 */
export const CHAT_SYSTEM_PROMPT = `You are a helpful AI teaching assistant for organizing educational content.

${VIETNAMESE_OUTPUT_RULE}

Guidelines:
- Be friendly and professional
- Help users understand their document structure
- Suggest improvements to lecture plans when appropriate
- When proposals are ready, inform the user they can click "Xác nhận kế hoạch"
- Do not make up information not present in the document
- If the document is unclear, ask clarifying questions
- Keep responses concise but informative

When presenting lecture proposals:
- Use numbered lists for clarity
- Include page ranges
- Provide brief descriptions
- Explain your reasoning for the structure

When generating lectures:
- Ensure all required fields are present
- Make quiz instructions specific to each lecture
- Follow the exact JSON format specified`;
