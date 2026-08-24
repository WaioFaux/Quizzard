import { z } from "zod";
import { Role, QuestionType, QuestionStatus } from "@prisma/client";

// ---------- Shared Json types ----------

export interface SourceRef {
  materialId: string;
  startPage: number;
  endPage: number;
}

export const SourceRefSchema: z.ZodType<SourceRef> = z.object({
  materialId: z.string().cuid("Invalid material ID"),
  startPage: z.number().int().min(1, "Start page must be at least 1"),
  endPage: z.number().int().min(1, "End page must be at least 1"),
}).refine((data) => data.endPage >= data.startPage, {
  message: "End page must be greater than or equal to start page",
});

// ---------- Auth ----------

export const SignupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.nativeEnum(Role),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ---------- Classes ----------

export const CreateClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100),
  description: z.string().max(500).optional(),
  classPassword: z.string().min(4, "Password must be at least 4 characters").max(50),
});

export const UpdateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  classPassword: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .max(50)
    .optional(),
});

export const JoinClassSchema = z.object({
  classCode: z.string().min(1, "Class code is required"),
  classPassword: z.string().min(1, "Class password is required"),
});

// ---------- Lectures ----------

export const CreateLectureSchema = z.object({
  classId: z.string().cuid("Invalid class ID"),
  title: z.string().min(1, "Title is required").max(200),
  sourceRef: SourceRefSchema.optional().nullable(),
  materialId: z.string().cuid("Invalid material ID").optional().nullable(),
  order: z.number().int().positive().optional(),
});

export const UpdateLectureSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  sourceRef: SourceRefSchema.optional().nullable(),
  order: z.number().int().positive().optional(),
  materialId: z.string().cuid("Invalid material ID").optional().nullable(),
});

// ---------- Quizzes ----------

export const CreateQuizSchema = z.object({
  lectureId: z.string().cuid("Invalid lecture ID"),
  instructions: z.string().min(1, "Instructions are required").max(5000),
  questionsPerAttempt: z
    .number()
    .int()
    .min(1, "At least 1 question per attempt")
    .max(100),
  timeLimitMinutes: z
    .number()
    .int()
    .min(1, "Time limit must be at least 1 minute")
    .max(300),
  deadline: z.string().datetime().optional().nullable(),
});

export const UpdateQuizSchema = z.object({
  instructions: z.string().min(1).max(5000).optional(),
  questionsPerAttempt: z.number().int().min(1).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(300).optional(),
});

export const PublishQuizSchema = z.object({
  deadline: z.string().datetime().optional().nullable(),
});

export const ExtendDeadlineSchema = z.object({
  deadline: z.string().datetime("Invalid deadline format"),
});

// ---------- Question Bank ----------

const MCQContentSchema = z.object({
  type: z.literal("MCQ"),
  prompt: z.string().min(1, "Question prompt is required"),
  options: z
    .array(z.string().min(1))
    .min(2, "At least 2 options required")
    .max(10),
  correctOptionIndex: z
    .number()
    .int()
    .min(0)
    .refine((val, ctx) => {
      const parent = ctx.parent as { options?: string[] };
      if (parent.options && val >= parent.options.length) {
        return false;
      }
      return true;
    }, "correctOptionIndex out of range"),
  explanation: z.string().optional(),
});

const ShortAnswerContentSchema = z.object({
  type: z.literal("SHORT_ANSWER"),
  prompt: z.string().min(1, "Question prompt is required"),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().optional(),
});

const EssayContentSchema = z.object({
  type: z.literal("ESSAY"),
  prompt: z.string().min(1, "Question prompt is required"),
  rubric: z.string().optional(),
});

const CalculationContentSchema = z.object({
  type: z.literal("CALCULATION"),
  promptTemplate: z.string().min(1, "Prompt template is required"),
  variables: z
    .array(
      z.object({
        name: z.string().min(1),
        min: z.number(),
        max: z.number(),
        decimals: z.number().int().min(0).max(10).optional(),
      })
    )
    .min(1, "At least 1 variable required"),
  answerFormula: z.string().min(1, "Answer formula is required"),
  explanation: z.string().optional(),
});

export const QuestionContentSchema = z.discriminatedUnion("type", [
  MCQContentSchema,
  ShortAnswerContentSchema,
  EssayContentSchema,
  CalculationContentSchema,
]);

export const CreateQuestionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  content: QuestionContentSchema,
  status: z.nativeEnum(QuestionStatus).optional().default(QuestionStatus.DRAFT),
  generationInstruction: z.string().optional(),
});

export const UpdateQuestionSchema = z.object({
  content: QuestionContentSchema.optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
  reviewNote: z.string().optional().nullable(),
});

export const UpdateQuestionStatusSchema = z.object({
  status: z.nativeEnum(QuestionStatus),
});

// ---------- Attempts ----------

const MCQAnswerSchema = z.object({
  type: z.literal("MCQ"),
  selectedOptionIndex: z.number().int().min(0),
});

const ShortAnswerAnswerSchema = z.object({
  type: z.literal("SHORT_ANSWER"),
  text: z.string().min(1, "Answer text is required"),
});

const EssayAnswerSchema = z.object({
  type: z.literal("ESSAY"),
  text: z.string().min(1, "Answer text is required"),
});

const CalculationAnswerSchema = z.object({
  type: z.literal("CALCULATION"),
  value: z.number(),
});

export const StudentAnswerValueSchema = z.discriminatedUnion("type", [
  MCQAnswerSchema,
  ShortAnswerAnswerSchema,
  EssayAnswerSchema,
  CalculationAnswerSchema,
]);

export const StartAttemptSchema = z.object({
  quizId: z.string().cuid("Invalid quiz ID"),
});

export const SaveAnswerSchema = z.object({
  answers: z.array(
    z.object({
      questionBankItemId: z.string().cuid("Invalid question ID"),
      partialAnswer: z.boolean().optional(),
      answer: StudentAnswerValueSchema,
    })
  ),
});

export const SubmitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionBankItemId: z.string().cuid("Invalid question ID"),
        answer: StudentAnswerValueSchema,
      })
    )
    .min(1, "At least one answer required"),
});

// ---------- Reports ----------

export const CreateReportSchema = z.object({
  studentAnswerId: z.string().cuid("Invalid answer ID"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
});

// ---------- Pagination ----------

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ---------- Types ----------

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateClassInput = z.infer<typeof CreateClassSchema>;
export type UpdateClassInput = z.infer<typeof UpdateClassSchema>;
export type JoinClassInput = z.infer<typeof JoinClassSchema>;
export type CreateLectureInput = z.infer<typeof CreateLectureSchema>;
export type UpdateLectureInput = z.infer<typeof UpdateLectureSchema>;
export type CreateQuizInput = z.infer<typeof CreateQuizSchema>;
export type UpdateQuizInput = z.infer<typeof UpdateQuizSchema>;
export type PublishQuizInput = z.infer<typeof PublishQuizSchema>;
export type ExtendDeadlineInput = z.infer<typeof ExtendDeadlineSchema>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type UpdateQuestionStatusInput = z.infer<typeof UpdateQuestionStatusSchema>;
export type StartAttemptInput = z.infer<typeof StartAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof SaveAnswerSchema>;
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
