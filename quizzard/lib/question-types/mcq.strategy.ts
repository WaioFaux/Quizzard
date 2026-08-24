import { QuestionTypeStrategy, QuestionContent, MCQContent, StudentAnswerValue, CorrectAnswerSnapshot, GradeResult } from "./types";

function isMCQContent(content: unknown): content is MCQContent {
  if (typeof content !== "object" || content === null) return false;
  const c = content as Record<string, unknown>;
  return (
    c.type === "MCQ" &&
    typeof c.prompt === "string" &&
    Array.isArray(c.options) &&
    c.options.every((o) => typeof o === "string") &&
    typeof c.correctOptionIndex === "number"
  );
}

export const mcqStrategy: QuestionTypeStrategy = {
  validateContent(content: unknown): boolean {
    return isMCQContent(content);
  },

  renderForStudent(content: QuestionContent): QuestionContent {
    if (content.type !== "MCQ") return content;
    // Strip correct answer from content
    const { correctOptionIndex, ...studentContent } = content;
    return studentContent as QuestionContent;
  },

  grade(answer: StudentAnswerValue, correctAnswer: CorrectAnswerSnapshot): GradeResult {
    if (answer.type !== "MCQ") {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    if (!correctAnswer || correctAnswer === null) {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    const correct = correctAnswer as { correctIndex: number };
    const isCorrect = answer.selectedOptionIndex === correct.correctIndex;

    return {
      isCorrect,
      pointsAwarded: isCorrect ? 1 : 0,
      feedback: isCorrect ? undefined : `Correct answer was option ${correct.correctIndex + 1}`,
    };
  },
};
