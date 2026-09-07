import { describe, it, expect } from "vitest";
import { mcqStrategy } from "./mcq.strategy";
import { shortAnswerStrategy } from "./short-answer.strategy";
import { calculationStrategy } from "./calculation.strategy";
import { getStrategy, gradeAnswer } from "./index";

describe("MCQ Strategy", () => {
  const validContent = {
    type: "MCQ" as const,
    prompt: "What is 2+2?",
    options: ["3", "4", "5", "6"],
    correctOptionIndex: 1,
    explanation: "Basic addition",
  };

  it("validateContent should accept valid MCQ content", () => {
    expect(mcqStrategy.validateContent(validContent)).toBe(true);
  });

  it("validateContent should reject invalid content", () => {
    expect(mcqStrategy.validateContent({ type: "MCQ", prompt: "Test" })).toBe(false);
    expect(mcqStrategy.validateContent({ type: "SHORT_ANSWER", prompt: "Test", correctAnswer: "ans" })).toBe(false);
    expect(mcqStrategy.validateContent(null)).toBe(false);
    expect(mcqStrategy.validateContent({})).toBe(false);
  });

  it("renderForStudent should strip correctOptionIndex", () => {
    const result = mcqStrategy.renderForStudent(validContent) as Record<string, unknown>;
    expect(result.correctOptionIndex).toBeUndefined();
    expect(result.prompt).toBe("What is 2+2?");
    expect(result.options).toEqual(["3", "4", "5", "6"]);
  });

  it("grade should award point for correct answer", () => {
    const correctAnswer = { correctIndex: 1 };
    const result = mcqStrategy.grade(
      { type: "MCQ", selectedOptionIndex: 1 },
      correctAnswer
    );
    expect(result.isCorrect).toBe(true);
    expect(result.pointsAwarded).toBe(1);
  });

  it("grade should award 0 for wrong answer", () => {
    const correctAnswer = { correctIndex: 1 };
    const result = mcqStrategy.grade(
      { type: "MCQ", selectedOptionIndex: 2 },
      correctAnswer
    );
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it("grade should return false for null correct answer", () => {
    const result = mcqStrategy.grade(
      { type: "MCQ", selectedOptionIndex: 1 },
      null
    );
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });
});

describe("Short Answer Strategy", () => {
  const validContent = {
    type: "SHORT_ANSWER" as const,
    prompt: "What is the capital of France?",
    correctAnswer: "Paris",
    explanation: "Paris is the capital",
  };

  it("validateContent should accept valid SHORT_ANSWER content", () => {
    expect(shortAnswerStrategy.validateContent(validContent)).toBe(true);
  });

  it("validateContent should reject invalid content", () => {
    expect(shortAnswerStrategy.validateContent({ type: "SHORT_ANSWER", prompt: "Test" })).toBe(false);
    expect(shortAnswerStrategy.validateContent({ type: "MCQ", prompt: "Test", options: [], correctOptionIndex: 0 })).toBe(false);
  });

  it("renderForStudent should strip correctAnswer", () => {
    const result = shortAnswerStrategy.renderForStudent(validContent) as Record<string, unknown>;
    expect(result.correctAnswer).toBeUndefined();
    expect(result.prompt).toBe("What is the capital of France?");
  });

  it("grade should be case-insensitive", () => {
    const correctAnswer = { correctAnswer: "Paris" };
    expect(shortAnswerStrategy.grade({ type: "SHORT_ANSWER", text: "paris" }, correctAnswer).isCorrect).toBe(true);
    expect(shortAnswerStrategy.grade({ type: "SHORT_ANSWER", text: "PARIS" }, correctAnswer).isCorrect).toBe(true);
    expect(shortAnswerStrategy.grade({ type: "SHORT_ANSWER", text: "  Paris  " }, correctAnswer).isCorrect).toBe(true);
  });

  it("grade should trim whitespace", () => {
    const correctAnswer = { correctAnswer: "Paris" };
    expect(shortAnswerStrategy.grade({ type: "SHORT_ANSWER", text: " Paris " }, correctAnswer).isCorrect).toBe(true);
  });

  it("grade should reject wrong answer", () => {
    const correctAnswer = { correctAnswer: "Paris" };
    const result = shortAnswerStrategy.grade({ type: "SHORT_ANSWER", text: "London" }, correctAnswer);
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });
});

describe("Calculation Strategy", () => {
  const validContent = {
    type: "CALCULATION" as const,
    promptTemplate: "A firm has revenue {revenue} and cost {cost}. Compute the margin.",
    variables: [
      { name: "revenue", min: 1000, max: 5000, decimals: 0 },
      { name: "cost", min: 500, max: 2000, decimals: 0 },
    ],
    answerFormula: "(revenue - cost) / revenue * 100",
    explanation: "Margin = (Revenue - Cost) / Revenue",
  };

  it("validateContent should accept valid CALCULATION content", () => {
    expect(calculationStrategy.validateContent(validContent)).toBe(true);
  });

  it("validateContent should reject invalid content", () => {
    expect(calculationStrategy.validateContent({ type: "CALCULATION" })).toBe(false);
    expect(calculationStrategy.validateContent({
      type: "CALCULATION",
      promptTemplate: "Test",
      variables: [],
      answerFormula: "x + y",
    })).toBe(false);
  });

  it("rollForStudent should produce deterministic results for same seed", () => {
    const result1 = calculationStrategy.rollForStudent!(validContent, "test-seed-123");
    const result2 = calculationStrategy.rollForStudent!(validContent, "test-seed-123");
    expect(result1.correctValue).toBe(result2.correctValue);
    expect(result1.substitutedContent.promptTemplate).toBe(result2.substitutedContent.promptTemplate);
  });

  it("rollForStudent should produce different results for different seeds", () => {
    const result1 = calculationStrategy.rollForStudent!(validContent, "seed-1");
    const result2 = calculationStrategy.rollForStudent!(validContent, "seed-2");
    // Different seeds should produce different substituted prompts (different rolled values)
    expect(result1.substitutedContent.promptTemplate).not.toBe(result2.substitutedContent.promptTemplate);
  });

  it("rollForStudent should interpolate variables into prompt", () => {
    const content = {
      type: "CALCULATION" as const,
      promptTemplate: "{a} + {b} = ?",
      variables: [
        { name: "a", min: 1, max: 10, decimals: 0 },
        { name: "b", min: 1, max: 10, decimals: 0 },
      ],
      answerFormula: "a + b",
    };
    const result = calculationStrategy.rollForStudent!(content, "simple-seed");
    expect(result.substitutedContent.promptTemplate).toMatch(/\d+ \+ \d+ = \?/);
  });

  it("rollForStudent should respect decimals setting", () => {
    const content = {
      type: "CALCULATION" as const,
      promptTemplate: "{x}",
      variables: [
        { name: "x", min: 1.0, max: 2.0, decimals: 2 },
      ],
      answerFormula: "x",
    };
    const result = calculationStrategy.rollForStudent!(content, "decimals-test");
    // Extract the number from the prompt
    const match = result.substitutedContent.promptTemplate.match(/(\d+\.\d{2})/);
    expect(match).not.toBeNull();
  });

  it("grade should accept value within tolerance", () => {
    const correctAnswer = { correctValue: 10.0 };
    expect(calculationStrategy.grade({ type: "CALCULATION", value: 10.0 }, correctAnswer).isCorrect).toBe(true);
    expect(calculationStrategy.grade({ type: "CALCULATION", value: 10.0005 }, correctAnswer).isCorrect).toBe(true);
    expect(calculationStrategy.grade({ type: "CALCULATION", value: 10.005 }, correctAnswer).isCorrect).toBe(false);
  });

  it("grade should reject wrong value", () => {
    const correctAnswer = { correctValue: 10.0 };
    expect(calculationStrategy.grade({ type: "CALCULATION", value: 5.0 }, correctAnswer).isCorrect).toBe(false);
  });
});

describe("Strategy Registry", () => {
  it("getStrategy should return correct strategy for each type", () => {
    expect(getStrategy("MCQ")).toBe(mcqStrategy);
    expect(getStrategy("SHORT_ANSWER")).toBe(shortAnswerStrategy);
    expect(getStrategy("CALCULATION")).toBe(calculationStrategy);
  });

  it("getStrategy should throw for unknown type", () => {
    expect(() => getStrategy("UNKNOWN" as never)).toThrow("Unknown question type");
  });

  it("gradeAnswer should delegate to correct strategy", () => {
    const result = gradeAnswer("MCQ", { type: "MCQ", selectedOptionIndex: 1 }, { correctIndex: 1 });
    expect(result.isCorrect).toBe(true);
  });
});
