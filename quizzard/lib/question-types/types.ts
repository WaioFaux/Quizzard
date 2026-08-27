// Question type discriminated union — mirrors ARCHITECTURE.md §Json fields

export type MCQContent = {
  type: "MCQ";
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

export type ShortAnswerContent = {
  type: "SHORT_ANSWER";
  prompt: string;
  correctAnswer: string;
  explanation?: string;
};

export type CalculationContent = {
  type: "CALCULATION";
  promptTemplate: string;
  variables: {
    name: string;
    min: number;
    max: number;
    decimals?: number;
  }[];
  answerFormula: string;
  explanation?: string;
};

export type QuestionContent =
  | MCQContent
  | ShortAnswerContent
  | CalculationContent;

export type QuestionType = "MCQ" | "SHORT_ANSWER" | "CALCULATION";

// Answer shapes
export type MCQAnswer = { type: "MCQ"; selectedOptionIndex: number };
export type ShortAnswerAnswer = { type: "SHORT_ANSWER"; text: string };
export type CalculationAnswer = { type: "CALCULATION"; value: number };

export type StudentAnswerValue =
  | MCQAnswer
  | ShortAnswerAnswer
  | CalculationAnswer;

// Correct answer snapshots
export type MCQCorrectAnswer = { correctIndex: number };
export type ShortAnswerCorrectAnswer = { correctAnswer: string };
export type CalculationCorrectAnswer = { correctValue: number };
export type CorrectAnswerSnapshot =
  | MCQCorrectAnswer
  | ShortAnswerCorrectAnswer
  | CalculationCorrectAnswer;

// Grading result
export type GradeResult = {
  isCorrect: boolean;
  pointsAwarded: number;
  feedback?: string;
};

export interface QuestionTypeStrategy {
  validateContent(content: unknown): boolean;
  renderForStudent(content: QuestionContent): QuestionContent;
  grade(
    answer: StudentAnswerValue,
    correctAnswer: CorrectAnswerSnapshot
  ): GradeResult;
  rollForStudent?(
    content: CalculationContent,
    seed: string
  ): {
    substitutedContent: CalculationContent;
    correctValue: number;
  };
}
