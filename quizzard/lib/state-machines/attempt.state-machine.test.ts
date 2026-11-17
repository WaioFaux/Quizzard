import { describe, it, expect } from "vitest";
import { transitionAttempt } from "./attempt.state-machine";
import { AttemptStatus } from "@prisma/client";

describe("Attempt State Machine", () => {
  it("should allow IN_PROGRESS to SUBMITTED", () => {
    expect(() => transitionAttempt(AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED)).not.toThrow();
  });

  it("should allow IN_PROGRESS to AUTO_SUBMITTED", () => {
    expect(() => transitionAttempt(AttemptStatus.IN_PROGRESS, AttemptStatus.AUTO_SUBMITTED)).not.toThrow();
  });

  it("should throw on SUBMITTED to any status", () => {
    expect(() => transitionAttempt(AttemptStatus.SUBMITTED, AttemptStatus.IN_PROGRESS as never))
      .toThrow("Chuyển trạng thái Attempt không hợp lệ từ SUBMITTED sang IN_PROGRESS");
  });

  it("should throw on AUTO_SUBMITTED to any status", () => {
    expect(() => transitionAttempt(AttemptStatus.AUTO_SUBMITTED, AttemptStatus.IN_PROGRESS as never))
      .toThrow("Chuyển trạng thái Attempt không hợp lệ từ AUTO_SUBMITTED sang IN_PROGRESS");
  });

  it("should throw on IN_PROGRESS to IN_PROGRESS", () => {
    expect(() => transitionAttempt(AttemptStatus.IN_PROGRESS, AttemptStatus.IN_PROGRESS as never))
      .toThrow("Chuyển trạng thái Attempt không hợp lệ");
  });
});
