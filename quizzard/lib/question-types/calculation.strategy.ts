import { createHash } from "crypto";
import { evaluate } from "mathjs";
import { QuestionTypeStrategy, QuestionContent, CalculationContent, StudentAnswerValue, CorrectAnswerSnapshot, GradeResult } from "./types";

function isCalculationContent(content: unknown): boolean {
  if (typeof content !== "object" || content === null) return false;
  const c = content as Record<string, unknown>;
  return (
    c.type === "CALCULATION" &&
    typeof c.promptTemplate === "string" &&
    Array.isArray(c.variables) &&
    c.variables.length > 0 &&
    c.variables.every(
      (v: unknown) =>
        typeof v === "object" &&
        v !== null &&
        "name" in v &&
        "min" in v &&
        "max" in v
    ) &&
    typeof c.answerFormula === "string"
  );
}

function seededRandom(seed: string, index: number): number {
  const hash = createHash("sha256")
    .update(`${seed}:${index}`)
    .digest("hex");
  const num = parseInt(hash.slice(0, 8), 16);
  return (num % 10000) / 10000;
}

function rollVariable(
  name: string,
  min: number,
  max: number,
  decimals: number | undefined,
  seed: string,
  index: number
): number {
  const rand = seededRandom(seed, index);
  const value = min + rand * (max - min);
  return decimals !== undefined ? Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals) : value;
}

export const calculationStrategy: QuestionTypeStrategy = {
  validateContent(content: unknown): boolean {
    return isCalculationContent(content);
  },

  renderForStudent(content: QuestionContent): QuestionContent {
    return content;
  },

  rollForStudent(
    content: CalculationContent,
    seed: string
  ): {
    substitutedContent: CalculationContent;
    correctValue: number;
  } {
    const substitutions: Record<string, number> = {};

    content.variables.forEach((v, idx) => {
      substitutions[v.name] = rollVariable(v.name, v.min, v.max, v.decimals, seed, idx);
    });

    // Evaluate formula with substituted values
    let correctValue: number;
    try {
      const result = evaluate(content.answerFormula, substitutions);
      correctValue = typeof result === "number" ? result : Number(result);
      if (!Number.isFinite(correctValue)) {
        correctValue = 0;
      }
    } catch {
      correctValue = 0;
    }

    // Interpolate prompt template
    let prompt = content.promptTemplate;
    for (const [name, value] of Object.entries(substitutions)) {
      prompt = prompt.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }

    return {
      substitutedContent: {
        ...content,
        promptTemplate: prompt,
      },
      correctValue,
    };
  },

  grade(answer: StudentAnswerValue, correctAnswer: CorrectAnswerSnapshot): GradeResult {
    if (answer.type !== "CALCULATION") {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    if (!correctAnswer || correctAnswer === null) {
      return { isCorrect: false, pointsAwarded: 0 };
    }

    const correct = correctAnswer as { correctValue: number };
    // Allow small floating point tolerance
    const tolerance = 0.001;
    const isCorrect = Math.abs(answer.value - correct.correctValue) < tolerance;

    return {
      isCorrect,
      pointsAwarded: isCorrect ? 1 : 0,
      feedback: isCorrect
        ? undefined
        : `Correct answer was: ${correct.correctValue}`,
    };
  },
};
