import { QuestionTypeStrategy, QuestionContent, StudentAnswerValue, CorrectAnswerSnapshot, GradeResult } from "./types";

function isShortAnswerContent(content: unknown): boolean {
  if (typeof content !== "object" || content === null) return false;
  const c = content as Record<string, unknown>;
  return (
    c.type === "SHORT_ANSWER" &&
    typeof c.prompt === "string" &&
    typeof c.correctAnswer === "string"
  );
}

export const shortAnswerStrategy: QuestionTypeStrategy = {
  validateContent(content: unknown): boolean {
    return isShortAnswerContent(content);
  },

  renderForStudent(content: QuestionContent): QuestionContent {
    if (content.type !== "SHORT_ANSWER") return content;
    const { correctAnswer, ...studentContent } = content;
    return studentContent as QuestionContent;
  },

  grade(answer: StudentAnswerValue, correctAnswer: CorrectAnswerSnapshot): GradeResult {
    if (answer.type !== "SHORT_ANSWER") {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    if (!correctAnswer || correctAnswer === null) {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    const correct = correctAnswer as { correctAnswer: string };
    // Case-insensitive trim comparison
    const studentAnswer = answer.text.trim().toLowerCase();
    const correctText = correct.correctAnswer.trim().toLowerCase();

    const isCorrect = studentAnswer === correctText;

    return {
      isCorrect,
      pointsAwarded: isCorrect ? 1 : 0,
      feedback: isCorrect
        ? undefined
        : `Correct answer was: ${correct.correctAnswer}`,
    };
  },
};
