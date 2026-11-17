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
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
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
    super("Quiz deadline has passed", "DEADLINE_PASSED", 400);
    this.name = "DeadlinePassedError";
  }
}

export class AttemptInProgressError extends AppError {
  constructor() {
    super(
      "You already have an attempt in progress for this quiz",
      "ATTEMPT_EXISTS",
      409
    );
    this.name = "AttemptInProgressError";
  }
}

export class QuizNotPublishedError extends AppError {
  constructor() {
    super("Quiz is not published yet", "QUIZ_NOT_PUBLISHED", 400);
    this.name = "QuizNotPublishedError";
  }
}

export class AIProviderError extends AppError {
  constructor(
    message = "The AI service is temporarily unavailable. Please try again in a moment."
  ) {
    super(message, "AI_UNAVAILABLE", 503);
    this.name = "AIProviderError";
  }
}

export class IllegalTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super(
      `Illegal ${entity} transition from ${from} to ${to}`,
      "ILLEGAL_TRANSITION",
      400
    );
    this.name = "IllegalTransitionError";
  }
}

export class DeadlineShortenError extends AppError {
  constructor() {
    super("Cannot shorten deadline", "DEADLINE_SHORTEN_FORBIDDEN", 400);
    this.name = "DeadlineShortenError";
  }
}

export class QuizAlreadyPublishedError extends AppError {
  constructor() {
    super(
      "Cannot modify question bank of a published quiz",
      "QUIZ_ALREADY_PUBLISHED",
      400
    );
    this.name = "QuizAlreadyPublishedError";
  }
}
