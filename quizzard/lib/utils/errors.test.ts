import { describe, it, expect } from "vitest";
import {
  AppError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  DeadlinePassedError,
  AttemptInProgressError,
  QuizNotPublishedError,
  IllegalTransitionError,
  QuizAlreadyPublishedError,
} from "./errors";

describe("AppError", () => {
  it("should create error with message, code, and status", () => {
    const error = new AppError("test message", "TEST_CODE", 422);
    expect(error.message).toBe("test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.statusCode).toBe(422);
    expect(error.name).toBe("AppError");
  });

  it("should default statusCode to 400", () => {
    const error = new AppError("test", "TEST");
    expect(error.statusCode).toBe(400);
  });
});

describe("AuthorizationError", () => {
  it("should have correct defaults", () => {
    const error = new AuthorizationError();
    expect(error.message).toBe("Không có quyền truy cập");
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe("AuthorizationError");
  });

  it("should accept custom message", () => {
    const error = new AuthorizationError("Custom message");
    expect(error.message).toBe("Custom message");
  });
});

describe("NotFoundError", () => {
  it("should default resource to 'Tài nguyên'", () => {
    const error = new NotFoundError();
    expect(error.message).toBe("Không tìm thấy Tài nguyên");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("NotFoundError");
  });

  it("should format resource name", () => {
    const error = new NotFoundError("Lớp");
    expect(error.message).toBe("Không tìm thấy Lớp");
  });
});

describe("ValidationError", () => {
  it("should have correct defaults", () => {
    const error = new ValidationError("Invalid input");
    expect(error.message).toBe("Invalid input");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("ValidationError");
  });
});

describe("ConflictError", () => {
  it("should have correct defaults", () => {
    const error = new ConflictError("Already exists");
    expect(error.message).toBe("Already exists");
    expect(error.code).toBe("CONFLICT");
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe("ConflictError");
  });
});

describe("DeadlinePassedError", () => {
  it("should have correct message and code", () => {
    const error = new DeadlinePassedError();
    expect(error.message).toBe("Đã quá hạn chót của bài kiểm tra");
    expect(error.code).toBe("DEADLINE_PASSED");
    expect(error.statusCode).toBe(400);
  });
});

describe("AttemptInProgressError", () => {
  it("should have correct message and code", () => {
    const error = new AttemptInProgressError();
    expect(error.message).toBe(
      "Bạn đang có một lượt làm bài chưa hoàn thành cho bài kiểm tra này"
    );
    expect(error.code).toBe("ATTEMPT_EXISTS");
    expect(error.statusCode).toBe(409);
  });
});

describe("QuizNotPublishedError", () => {
  it("should have correct message and code", () => {
    const error = new QuizNotPublishedError();
    expect(error.message).toBe("Bài kiểm tra chưa được xuất bản");
    expect(error.code).toBe("QUIZ_NOT_PUBLISHED");
    expect(error.statusCode).toBe(400);
  });
});

describe("IllegalTransitionError", () => {
  it("should format transition message", () => {
    const error = new IllegalTransitionError("Quiz", "DRAFT", "PUBLISHED");
    expect(error.message).toBe(
      "Chuyển trạng thái Quiz không hợp lệ từ DRAFT sang PUBLISHED"
    );
    expect(error.code).toBe("ILLEGAL_TRANSITION");
    expect(error.statusCode).toBe(400);
  });
});

describe("QuizAlreadyPublishedError", () => {
  it("should have correct message and code", () => {
    const error = new QuizAlreadyPublishedError();
    expect(error.message).toBe(
      "Không thể chỉnh sửa ngân hàng câu hỏi của bài kiểm tra đã xuất bản"
    );
    expect(error.code).toBe("QUIZ_ALREADY_PUBLISHED");
    expect(error.statusCode).toBe(400);
  });
});

describe("Error class hierarchy", () => {
  it("all errors should be instanceof Error", () => {
    expect(new AppError("test", "T", 400)).toBeInstanceOf(Error);
    expect(new AuthorizationError()).toBeInstanceOf(Error);
    expect(new NotFoundError()).toBeInstanceOf(Error);
    expect(new ValidationError("test")).toBeInstanceOf(Error);
    expect(new ConflictError("test")).toBeInstanceOf(Error);
    expect(new DeadlinePassedError()).toBeInstanceOf(Error);
    expect(new AttemptInProgressError()).toBeInstanceOf(Error);
    expect(new QuizNotPublishedError()).toBeInstanceOf(Error);
    expect(new IllegalTransitionError("X", "A", "B")).toBeInstanceOf(Error);
    expect(new QuizAlreadyPublishedError()).toBeInstanceOf(Error);
  });

  it("all errors should be instanceof AppError", () => {
    expect(new AuthorizationError()).toBeInstanceOf(AppError);
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ValidationError("test")).toBeInstanceOf(AppError);
    expect(new ConflictError("test")).toBeInstanceOf(AppError);
  });
});
