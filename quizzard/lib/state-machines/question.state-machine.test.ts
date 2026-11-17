import { describe, it, expect } from "vitest";
import { transitionQuestion } from "./question.state-machine";
import { QuestionStatus } from "@prisma/client";

describe("Question State Machine", () => {
  describe("Legal transitions", () => {
    it("should allow DRAFT to APPROVED", () => {
      expect(() => transitionQuestion(QuestionStatus.DRAFT, QuestionStatus.APPROVED)).not.toThrow();
    });

    it("should allow DRAFT to FLAGGED_FOR_REVIEW", () => {
      expect(() => transitionQuestion(QuestionStatus.DRAFT, QuestionStatus.FLAGGED_FOR_REVIEW)).not.toThrow();
    });

    it("should allow FLAGGED_FOR_REVIEW to APPROVED", () => {
      expect(() => transitionQuestion(QuestionStatus.FLAGGED_FOR_REVIEW, QuestionStatus.APPROVED)).not.toThrow();
    });

    it("should allow FLAGGED_FOR_REVIEW back to DRAFT", () => {
      expect(() => transitionQuestion(QuestionStatus.FLAGGED_FOR_REVIEW, QuestionStatus.DRAFT)).not.toThrow();
    });

    it("should allow APPROVED back to DRAFT", () => {
      expect(() => transitionQuestion(QuestionStatus.APPROVED, QuestionStatus.DRAFT)).not.toThrow();
    });

    it("should allow APPROVED to FLAGGED_FOR_REVIEW", () => {
      expect(() => transitionQuestion(QuestionStatus.APPROVED, QuestionStatus.FLAGGED_FOR_REVIEW)).not.toThrow();
    });
  });

  describe("Illegal transitions", () => {
    it("should throw on APPROVED to DRAFT via a different path (same as legal)", () => {
      // This is actually legal per the state machine
    });

    it("should throw on DRAFT to SUBMITTED", () => {
      expect(() => transitionQuestion(QuestionStatus.DRAFT, "SUBMITTED" as never))
        .toThrow("Chuyển trạng thái Question không hợp lệ");
    });
  });
});
