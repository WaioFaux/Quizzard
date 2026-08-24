import { QuestionTypeStrategy, QuestionContent, StudentAnswerValue, CorrectAnswerSnapshot, GradeResult } from "./types";

function isEssayContent(content: unknown): boolean {
  if (typeof content !== "object" || content === null) return false;
  const c = content as Record<string, unknown>;
  return c.type === "ESSAY" && typeof c.prompt === "string";
}

export const essayStrategy: QuestionTypeStrategy = {
  validateContent(content: unknown): boolean {
    return isEssayContent(content);
  },

  renderForStudent(content: QuestionContent): QuestionContent {
    // ESSAY content is the same for students and teachers (no answer to strip)
    return content;
  },

  grade(_answer: StudentAnswerValue, correctAnswer: CorrectAnswerSnapshot): GradeResult {
    // ESSAY is manually graded — always return 0, no auto-grading
    if (correctAnswer !== null) {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    return {
      isCorrect: false,
      pointsAwarded: 0,
      feedback: "This question requires manual grading.",
    };
  },
};
