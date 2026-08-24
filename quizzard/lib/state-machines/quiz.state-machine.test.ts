import { describe, it, expect } from "vitest";
import { transitionQuiz } from "./quiz.state-machine";
import { QuizStatus } from "@prisma/client";

describe("Quiz State Machine", () => {
  it("should allow DRAFT to PUBLISHED transition", () => {
    expect(() => transitionQuiz(QuizStatus.DRAFT, QuizStatus.PUBLISHED)).not.toThrow();
  });

  it("should throw on PUBLISHED to DRAFT transition", () => {
    expect(() => transitionQuiz(QuizStatus.PUBLISHED, QuizStatus.DRAFT))
      .toThrow("Illegal Quiz transition from PUBLISHED to DRAFT");
  });

  it("should throw on DRAFT to any other status", () => {
    expect(() => transitionQuiz(QuizStatus.DRAFT, QuizStatus.DRAFT as never))
      .toThrow("Illegal Quiz transition");
  });

  it("should throw on invalid from state", () => {
    expect(() => transitionQuiz("INVALID" as never, QuizStatus.PUBLISHED))
      .toThrow("Illegal Quiz transition");
  });
});
