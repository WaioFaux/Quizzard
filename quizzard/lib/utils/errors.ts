export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Không có quyền truy cập") {
    super(message, "UNAUTHORIZED", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Tài nguyên") {
    super(`Không tìm thấy ${resource}`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class DeadlinePassedError extends AppError {
  constructor() {
    super("Đã quá hạn chót của bài kiểm tra", "DEADLINE_PASSED", 400);
    this.name = "DeadlinePassedError";
  }
}

export class AttemptInProgressError extends AppError {
  constructor() {
    super(
      "Bạn đang có một lượt làm bài chưa hoàn thành cho bài kiểm tra này",
      "ATTEMPT_EXISTS",
      409
    );
    this.name = "AttemptInProgressError";
  }
}

export class QuizNotPublishedError extends AppError {
  constructor() {
    super("Bài kiểm tra chưa được xuất bản", "QUIZ_NOT_PUBLISHED", 400);
    this.name = "QuizNotPublishedError";
  }
}

export class AIProviderError extends AppError {
  constructor(
    message = "Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau giây lát."
  ) {
    super(message, "AI_UNAVAILABLE", 503);
    this.name = "AIProviderError";
  }
}

/**
 * The provider answered, but the answer was not usable - most often a
 * response that is not valid JSON because the model wrapped it in prose or
 * truncated it. This is reported separately from AIProviderError so the
 * user sees an actionable message instead of a generic server error.
 */
export class AIResponseError extends AppError {
  constructor(
    message = "AI trả về phản hồi không đọc được. Vui lòng thử lại."
  ) {
    super(message, "AI_INVALID_RESPONSE", 502);
    this.name = "AIResponseError";
  }
}

export class IllegalTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super(
      `Chuyển trạng thái ${entity} không hợp lệ từ ${from} sang ${to}`,
      "ILLEGAL_TRANSITION",
      400
    );
    this.name = "IllegalTransitionError";
  }
}

export class DeadlineShortenError extends AppError {
  constructor() {
    super("Không thể rút ngắn hạn chót", "DEADLINE_SHORTEN_FORBIDDEN", 400);
    this.name = "DeadlineShortenError";
  }
}

export class QuizAlreadyPublishedError extends AppError {
  constructor() {
    super(
      "Không thể chỉnh sửa ngân hàng câu hỏi của bài kiểm tra đã xuất bản",
      "QUIZ_ALREADY_PUBLISHED",
      400
    );
    this.name = "QuizAlreadyPublishedError";
  }
}
