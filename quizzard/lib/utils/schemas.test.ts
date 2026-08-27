import { describe, it, expect } from "vitest";
import {
  SignupSchema,
  LoginSchema,
  CreateClassSchema,
  JoinClassSchema,
  CreateLectureSchema,
  CreateQuizSchema,
  UpdateQuizSchema,
  CreateQuestionSchema,
  UpdateQuestionStatusSchema,
  StartAttemptSchema,
  SubmitAttemptSchema,
  CreateReportSchema,
  SourceRefSchema,
} from "./schemas";

describe("SignupSchema", () => {
  it("should accept valid teacher signup", () => {
    const result = SignupSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      role: "TEACHER",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid student signup", () => {
    const result = SignupSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      role: "STUDENT",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "not-an-email",
      password: "password123",
      role: "TEACHER",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "john@example.com",
      password: "12345",
      role: "TEACHER",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty name", () => {
    const result = SignupSchema.safeParse({
      name: "",
      email: "john@example.com",
      password: "password123",
      role: "TEACHER",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid role", () => {
    const result = SignupSchema.safeParse({
      name: "John",
      email: "john@example.com",
      password: "password123",
      role: "ADMIN",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateClassSchema", () => {
  it("should accept valid class", () => {
    const result = CreateClassSchema.safeParse({
      name: "Math 101",
      description: "Introduction to Mathematics",
      classPassword: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept without description", () => {
    const result = CreateClassSchema.safeParse({
      name: "Math 101",
      classPassword: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject name too long", () => {
    const result = CreateClassSchema.safeParse({
      name: "A".repeat(101),
      classPassword: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = CreateClassSchema.safeParse({
      name: "Math 101",
      classPassword: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("SourceRefSchema", () => {
  it("should accept valid SourceRef", () => {
    const result = SourceRefSchema.safeParse({
      materialId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      startPage: 1,
      endPage: 5,
    });
    expect(result.success).toBe(true);
  });

  it("should accept when startPage equals endPage", () => {
    const result = SourceRefSchema.safeParse({
      materialId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      startPage: 3,
      endPage: 3,
    });
    expect(result.success).toBe(true);
  });

  it("should reject when endPage is less than startPage", () => {
    const result = SourceRefSchema.safeParse({
      materialId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      startPage: 5,
      endPage: 3,
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid materialId", () => {
    const result = SourceRefSchema.safeParse({
      materialId: "not-a-cuid",
      startPage: 1,
      endPage: 5,
    });
    expect(result.success).toBe(false);
  });

  it("should reject startPage less than 1", () => {
    const result = SourceRefSchema.safeParse({
      materialId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      startPage: 0,
      endPage: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateLectureSchema", () => {
  it("should accept valid lecture with sourceRef", () => {
    const result = CreateLectureSchema.safeParse({
      classId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      title: "Introduction to Databases",
      sourceRef: {
        materialId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
        startPage: 1,
        endPage: 10,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept without sourceRef", () => {
    const result = CreateLectureSchema.safeParse({
      classId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      title: "Introduction to Databases",
    });
    expect(result.success).toBe(true);
  });

  it("should accept with materialId only", () => {
    const result = CreateLectureSchema.safeParse({
      classId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      title: "Chapter 1",
      materialId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty title", () => {
    const result = CreateLectureSchema.safeParse({
      classId: "cldxxxxxxxxxxxxxxxxxxxxxxxxxx01",
      title: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("JoinClassSchema", () => {
  it("should accept valid join", () => {
    const result = JoinClassSchema.safeParse({
      classCode: "ABC123",
      classPassword: "secret",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty classCode", () => {
    const result = JoinClassSchema.safeParse({
      classCode: "",
      classPassword: "secret",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateQuizSchema", () => {
  it("should accept valid quiz", () => {
    const result = CreateQuizSchema.safeParse({
      lectureId: "cld123",
      instructions: "Focus on chapters 1-3",
      questionsPerAttempt: 10,
      timeLimitMinutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it("should accept with optional deadline", () => {
    const result = CreateQuizSchema.safeParse({
      lectureId: "cld123",
      instructions: "Focus on chapters 1-3",
      questionsPerAttempt: 10,
      timeLimitMinutes: 30,
      deadline: "2026-12-31T23:59:59Z",
    });
    expect(result.success).toBe(true);
  });

  it("should reject questionsPerAttempt less than 1", () => {
    const result = CreateQuizSchema.safeParse({
      lectureId: "cld123",
      instructions: "Focus",
      questionsPerAttempt: 0,
      timeLimitMinutes: 30,
    });
    expect(result.success).toBe(false);
  });

  it("should reject timeLimitMinutes greater than 300", () => {
    const result = CreateQuizSchema.safeParse({
      lectureId: "cld123",
      instructions: "Focus",
      questionsPerAttempt: 10,
      timeLimitMinutes: 301,
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateQuestionSchema - MCQ", () => {
  it("should accept valid MCQ", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      content: {
        type: "MCQ",
        prompt: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        correctOptionIndex: 1,
        explanation: "Basic math",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject MCQ with less than 2 options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      content: {
        type: "MCQ",
        prompt: "What is 2+2?",
        options: ["4"],
        correctOptionIndex: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should accept SHORT_ANSWER", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "SHORT_ANSWER",
      content: {
        type: "SHORT_ANSWER",
        prompt: "Capital of France?",
        correctAnswer: "Paris",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject name too long", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "CALCULATION",
      content: {
        type: "CALCULATION",
        promptTemplate: "{a} + {b} = ?",
        variables: [
          { name: "a", min: 1, max: 10 },
          { name: "b", min: 1, max: 10 },
        ],
        answerFormula: "a + b",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("SubmitAttemptSchema", () => {
  it("should accept valid submission with MCQ answer", () => {
    const result = SubmitAttemptSchema.safeParse({
      answers: [
        {
          questionBankItemId: "qid123",
          answer: { type: "MCQ", selectedOptionIndex: 2 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should accept with multiple answer types", () => {
    const result = SubmitAttemptSchema.safeParse({
      answers: [
        { questionBankItemId: "q1", answer: { type: "MCQ", selectedOptionIndex: 1 } },
        { questionBankItemId: "q2", answer: { type: "SHORT_ANSWER", text: "Paris" } },
        { questionBankItemId: "q3", answer: { type: "CALCULATION", value: 42.5 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty answers array", () => {
    const result = SubmitAttemptSchema.safeParse({
      answers: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateReportSchema", () => {
  it("should accept valid report", () => {
    const result = CreateReportSchema.safeParse({
      studentAnswerId: "ans123",
      description: "I believe this question has an error because the options are incorrect.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject description too short", () => {
    const result = CreateReportSchema.safeParse({
      studentAnswerId: "ans123",
      description: "Wrong.",
    });
    expect(result.success).toBe(false);
  });

  it("should reject description too long", () => {
    const result = CreateReportSchema.safeParse({
      studentAnswerId: "ans123",
      description: "A".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
