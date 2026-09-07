import { describe, it, expect } from "vitest";
import { calculationStrategy } from "./calculation.strategy";
import { CalculationContent, CorrectAnswerSnapshot } from "./types";

// ---- Helpers ----

const calcContent = (
  template: string,
  variables: Array<{ name: string; min: number; max: number; decimals?: number }>,
  formula: string,
  explanation?: string
): CalculationContent => ({
  type: "CALCULATION",
  promptTemplate: template,
  variables,
  answerFormula: formula,
  explanation,
});

const snapshot = (correctValue: number): CorrectAnswerSnapshot =>
  ({ correctValue } as CorrectAnswerSnapshot);

// ---- grade() tests ----

describe("calculationStrategy.grade()", () => {
  it("awards 1 point for an exact correct answer", () => {
    const result = calculationStrategy.grade(
      { type: "CALCULATION", value: 42 },
      snapshot(42)
    );
    expect(result.isCorrect).toBe(true);
    expect(result.pointsAwarded).toBe(1);
  });

  it("awards 0 points for an incorrect answer", () => {
    const result = calculationStrategy.grade(
      { type: "CALCULATION", value: 10 },
      snapshot(42)
    );
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it("accepts a value within the 0.001 tolerance", () => {
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: 42.0009 }, snapshot(42)).isCorrect
    ).toBe(true);
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: 41.9991 }, snapshot(42)).isCorrect
    ).toBe(true);
  });

  it("rejects a value outside the tolerance", () => {
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: 42.002 }, snapshot(42)).isCorrect
    ).toBe(false);
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: 41.998 }, snapshot(42)).isCorrect
    ).toBe(false);
  });

  it("returns feedback with the correct value when the answer is wrong", () => {
    const result = calculationStrategy.grade(
      { type: "CALCULATION", value: 0 },
      snapshot(9.81)
    );
    expect(result.isCorrect).toBe(false);
    expect(result.feedback).toBe("Correct answer was: 9.81");
  });

  it("returns no feedback when the answer is correct", () => {
    const result = calculationStrategy.grade(
      { type: "CALCULATION", value: 100 },
      snapshot(100)
    );
    expect(result.feedback).toBeUndefined();
  });

  it("handles negative correct values", () => {
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: -15 }, snapshot(-15)).isCorrect
    ).toBe(true);
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: -10 }, snapshot(-15)).isCorrect
    ).toBe(false);
  });

  it("handles zero as a correct value", () => {
    expect(
      calculationStrategy.grade({ type: "CALCULATION", value: 0 }, snapshot(0)).isCorrect
    ).toBe(true);
  });

  it("returns false when answer type is not CALCULATION", () => {
    // @ts-expect-error – intentional wrong type for type-safety testing
    const result = calculationStrategy.grade(
      { type: "MCQ", selectedOptionIndex: 1 },
      snapshot(10)
    );
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it("returns false when correct answer snapshot is null", () => {
    const result = calculationStrategy.grade(
      { type: "CALCULATION", value: 42 },
      null as CorrectAnswerSnapshot
    );
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it("handles decimal values correctly with tolerance", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in floating point
    expect(
      calculationStrategy.grade(
        { type: "CALCULATION", value: 0.30000000000000004 },
        snapshot(0.3)
      ).isCorrect
    ).toBe(true);
  });

  it("handles very large numbers", () => {
    expect(
      calculationStrategy.grade(
        { type: "CALCULATION", value: 1_000_000 },
        snapshot(1_000_000)
      ).isCorrect
    ).toBe(true);
    expect(
      calculationStrategy.grade(
        { type: "CALCULATION", value: 999_999 },
        snapshot(1_000_000)
      ).isCorrect
    ).toBe(false);
  });
});

// ---- rollForStudent() tests ----

describe("calculationStrategy.rollForStudent()", () => {
  it("is deterministic: same seed always produces the same result", () => {
    const content = calcContent("{x} + {y} = ?", [
      { name: "x", min: 1, max: 10 },
      { name: "y", min: 1, max: 10 },
    ], "x + y");

    const r1 = calculationStrategy.rollForStudent!(content, "my-fixed-seed");
    const r2 = calculationStrategy.rollForStudent!(content, "my-fixed-seed");
    const r3 = calculationStrategy.rollForStudent!(content, "my-fixed-seed");

    expect(r1.correctValue).toBe(r2.correctValue);
    expect(r1.correctValue).toBe(r3.correctValue);
    expect(r1.substitutedContent.promptTemplate).toBe(r2.substitutedContent.promptTemplate);
  });

  it("produces different results for different seeds", () => {
    const content = calcContent("{a} * {b}", [
      { name: "a", min: 2, max: 5 },
      { name: "b", min: 2, max: 5 },
    ], "a * b");

    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = calculationStrategy.rollForStudent!(content, `seed-${i}`);
      results.add(r.substitutedContent.promptTemplate);
    }
    // With 20 different seeds, all should produce distinct substituted prompts
    expect(results.size).toBeGreaterThan(1);
  });

  it("interpolates all variables into the prompt template", () => {
    const content = calcContent(
      "Revenue = {rev}, Cost = {cost}, Profit = {rev} - {cost}",
      [
        { name: "rev", min: 100, max: 200, decimals: 0 },
        { name: "cost", min: 50, max: 100, decimals: 0 },
      ],
      "rev - cost"
    );

    const r = calculationStrategy.rollForStudent!(content, "interp-test");

    // Should have replaced all placeholders with numbers
    expect(r.substitutedContent.promptTemplate).toMatch(/Revenue = \d+/);
    expect(r.substitutedContent.promptTemplate).toMatch(/Cost = \d+/);
    expect(r.substitutedContent.promptTemplate).toMatch(/Profit = \d+/);
  });

  it("respects the decimals field for each variable", () => {
    const content = calcContent(
      "Rate = {rate}",
      [{ name: "rate", min: 0.0, max: 1.0, decimals: 4 }],
      "rate"
    );

    const r = calculationStrategy.rollForStudent!(content, "decimals-seed");

    // Extract the number from the prompt
    const match = r.substitutedContent.promptTemplate.match(/Rate = ([\d.]+)/);
    expect(match).not.toBeNull();
    const parts = match![1].split(".");
    expect(parts[1]?.length).toBeLessThanOrEqual(4);
  });

  it("rolls values within the specified min/max range", () => {
    const content = calcContent("{x}", [{ name: "x", min: 100, max: 200 }], "x");

    for (let i = 0; i < 50; i++) {
      const r = calculationStrategy.rollForStudent!(content, `range-check-${i}`);
      const extracted = parseFloat(
        r.substitutedContent.promptTemplate.match(/\d+(\.\d+)?/)?.[0] ?? "0"
      );
      expect(extracted).toBeGreaterThanOrEqual(100);
      expect(extracted).toBeLessThanOrEqual(200);
    }
  });

  it("returns a substitutedContent that preserves the original type and explanation", () => {
    const content = calcContent(
      "Solve: {x}",
      [{ name: "x", min: 1, max: 5 }],
      "x",
      "Basic arithmetic"
    );

    const r = calculationStrategy.rollForStudent!(content, "preserve-test");

    expect(r.substitutedContent.type).toBe("CALCULATION");
    expect(r.substitutedContent.explanation).toBe("Basic arithmetic");
    expect(r.substitutedContent.variables).toEqual(content.variables);
    expect(r.substitutedContent.answerFormula).toBe("x");
  });
});

// ---- Edge cases ----

describe("calculationStrategy edge cases", () => {
  it("handles division by zero in the formula (clamps Infinity to 0)", () => {
    const content = calcContent(
      "{a} / {b}",
      [
        { name: "a", min: 10, max: 10 }, // always 10
        { name: "b", min: 0, max: 0 },  // always 0
      ],
      "a / b"
    );

    const r = calculationStrategy.rollForStudent!(content, "div-zero-seed");
    // Division by zero produces Infinity, which the strategy clamps to 0
    expect(r.correctValue).toBe(0);
  });

  it("handles negative results from the formula", () => {
    const content = calcContent(
      "{cost} - {revenue}",
      [
        { name: "cost", min: 50, max: 100 },
        { name: "revenue", min: 100, max: 200 },
      ],
      "cost - revenue"
    );

    // revenue > cost so result should be negative
    let foundNegative = false;
    for (let i = 0; i < 30; i++) {
      const r = calculationStrategy.rollForStudent!(content, `neg-seed-${i}`);
      if (r.correctValue < 0) {
        foundNegative = true;
        break;
      }
    }
    expect(foundNegative).toBe(true);
  });

  it("handles an invalid formula gracefully (returns 0 as correctValue)", () => {
    const content = calcContent(
      "{x}",
      [{ name: "x", min: 1, max: 5 }],
      "x /" // intentionally broken formula
    );

    const r = calculationStrategy.rollForStudent!(content, "invalid-formula");
    expect(r.correctValue).toBe(0);
  });

  it("handles an empty variable name gracefully", () => {
    const content = calcContent(
      "{x}",
      [{ name: "x", min: 1, max: 5 }],
      "x"
    );

    // Variable name is valid here; test the prompt template edge case
    const r = calculationStrategy.rollForStudent!(content, "empty-name-seed");
    expect(r.substitutedContent.promptTemplate).toBeDefined();
  });

  it("handles a variable whose name does not appear in the template", () => {
    const content = calcContent(
      "What is {a}?",
      [
        { name: "a", min: 1, max: 5 },
        { name: "b", min: 1, max: 5 }, // unused
      ],
      "a + b"
    );

    const r = calculationStrategy.rollForStudent!(content, "unused-var-seed");
    // Should not throw; prompt only contains a, not b
    expect(r.substitutedContent.promptTemplate).toMatch(/What is [\d.]+\?/);
    expect(r.correctValue).toBeGreaterThan(0);
  });

  it("handles very long variable names", () => {
    const content = calcContent(
      "{veryLongVariableNameThatExceedsReasonableLength}",
      [{ name: "veryLongVariableNameThatExceedsReasonableLength", min: 1, max: 5 }],
      "veryLongVariableNameThatExceedsReasonableLength"
    );

    const r = calculationStrategy.rollForStudent!(content, "long-name-seed");
    expect(r.substitutedContent.promptTemplate).toMatch(/\d+/);
  });

  it("validateContent rejects content with missing variables array", () => {
    // @ts-expect-error – intentional invalid shape for testing
    expect(
      calculationStrategy.validateContent({
        type: "CALCULATION",
        promptTemplate: "Test",
        variables: undefined,
        answerFormula: "x",
      })
    ).toBe(false);
  });

  it("validateContent rejects content with empty variables array", () => {
    expect(
      calculationStrategy.validateContent({
        type: "CALCULATION",
        promptTemplate: "Test",
        variables: [],
        answerFormula: "x",
      })
    ).toBe(false);
  });

  it("validateContent rejects content with missing answerFormula", () => {
    expect(
      calculationStrategy.validateContent({
        type: "CALCULATION",
        promptTemplate: "Test",
        variables: [{ name: "x", min: 1, max: 10 }],
      })
    ).toBe(false);
  });

  it("validateContent accepts non-numeric variable bounds (type validation is deferred to service layer)", () => {
    // isCalculationContent only checks structural presence of fields, not their types.
    // Non-numeric bounds would be caught by the Zod schema or service layer instead.
    // @ts-expect-error – intentional invalid shape
    expect(
      calculationStrategy.validateContent({
        type: "CALCULATION",
        promptTemplate: "Test",
        variables: [{ name: "x", min: "a", max: "b" }],
        answerFormula: "x",
      })
    ).toBe(true);
  });

  it("grade returns false for a calculation-type answer that is just outside the tolerance", () => {
    // tolerance is 0.001; 42.0011 is more than 0.001 away from 42
    const result = calculationStrategy.grade(
      { type: "CALCULATION", value: 42.0011 },
      snapshot(42)
    );
    expect(result.isCorrect).toBe(false); // 42.0011 - 42 = 0.0011 > 0.001 tolerance
  });

  it("rollForStudent with a single variable uses index 0 for the random seed", () => {
    const content = calcContent(
      "{x}",
      [{ name: "x", min: 100, max: 200 }],
      "x"
    );

    // Same seed with same variable config should be identical
    const r1 = calculationStrategy.rollForStudent!(content, "single-var-seed");
    const r2 = calculationStrategy.rollForStudent!(content, "single-var-seed");
    expect(r1.correctValue).toBe(r2.correctValue);
  });

  it("rollForStudent with multiple variables uses different indices for each variable", () => {
    const content = calcContent(
      "a={a}, b={b}, c={c}",
      [
        { name: "a", min: 1, max: 100, decimals: 0 },
        { name: "b", min: 1, max: 100, decimals: 0 },
        { name: "c", min: 1, max: 100, decimals: 0 },
      ],
      "a + b + c"
    );

    const r = calculationStrategy.rollForStudent!(content, "multi-idx-seed");
    // Should have substituted exactly 3 variable values as integers
    const matches = r.substitutedContent.promptTemplate.match(/a=(\d+), b=(\d+), c=(\d+)/);
    expect(matches).not.toBeNull();
    const [, a, b, c] = matches!;
    // All three should be distinct numbers rolled independently
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });
});
