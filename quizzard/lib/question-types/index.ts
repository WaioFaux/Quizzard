import { QuestionTypeStrategy, QuestionType } from "./types";
import { mcqStrategy } from "./mcq.strategy";
import { shortAnswerStrategy } from "./short-answer.strategy";
import { calculationStrategy } from "./calculation.strategy";

export { QuestionTypeStrategy, QuestionType };
export {
  mcqStrategy,
  shortAnswerStrategy,
  calculationStrategy,
};

export function getStrategy(type: QuestionType): QuestionTypeStrategy {
  switch (type) {
    case "MCQ":
      return mcqStrategy;
    case "SHORT_ANSWER":
      return shortAnswerStrategy;
    case "CALCULATION":
      return calculationStrategy;
    default:
      throw new Error(`Unknown question type: ${type}`);
  }
}

export function gradeAnswer(
  type: QuestionType,
  answer: import("./types").StudentAnswerValue,
  correctAnswer: import("./types").CorrectAnswerSnapshot
): import("./types").GradeResult {
  return getStrategy(type).grade(answer, correctAnswer);
}

export function renderForStudent(
  type: QuestionType,
  content: import("./types").QuestionContent
): import("./types").QuestionContent {
  return getStrategy(type).renderForStudent(content);
}
