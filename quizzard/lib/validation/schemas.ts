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

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(100),
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
    .min(0, "correctOptionIndex must be non-negative"),
  explanation: z.string().optional(),
});

const ShortAnswerContentSchema = z.object({
  type: z.literal("SHORT_ANSWER"),
  prompt: z.string().min(1, "Question prompt is required"),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().optional(),
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

const CalculationAnswerSchema = z.object({
  type: z.literal("CALCULATION"),
  value: z.number(),
});

export const StudentAnswerValueSchema = z.discriminatedUnion("type", [
  MCQAnswerSchema,
  ShortAnswerAnswerSchema,
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

// ---------- Lecture planning chat ----------

export const LectureProposalSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  startPage: z.number().int().min(0).max(100000),
  endPage: z.number().int().min(0).max(100000),
  description: z.string().max(1000).optional(),
});

export const LectureProposalsSchema = z
  .array(LectureProposalSchema)
  .min(1, "At least one lecture proposal is required")
  .max(50, "Too many lecture proposals");

/**
 * Shape of a lecture produced by the AI when a plan is confirmed.
 *
 * The values come straight from a language model, so every field is
 * coerced: models routinely send page numbers and counts as strings. Anything
 * that cannot be coerced is rejected, which keeps malformed values away
 * from the database.
 */
export const LectureFormatSchema = z.object({
  title: z.string().trim().min(1, "Lecture title is required").max(200),
  sourceRef: z
    .object({
      startPage: z.coerce.number().int().min(0).max(100000),
      endPage: z.coerce.number().int().min(0).max(100000),
    })
    .optional(),
  quiz: z
    .object({
      instructions: z.preprocess(
        (value) =>
          typeof value === "string" || typeof value === "number"
            ? String(value)
            : undefined,
        z.string().trim().max(4000).optional()
      ),
      questionCount: z.coerce.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20000),
});

// ---------- Question bank chat ----------

const TypeConfigSchema = z.object({
  enabled: z.boolean(),
  count: z.number().int().min(0).max(100),
  distribution: z.object({
    easy: z.number().int().min(0).max(100),
    medium: z.number().int().min(0).max(100),
    hard: z.number().int().min(0).max(100),
  }),
});

export const GenerationPlanSchema = z.object({
  MCQ: TypeConfigSchema,
  SHORT_ANSWER: TypeConfigSchema,
  CALCULATION: TypeConfigSchema,
  customInstructions: z.string().max(2000).optional(),
});

// ---------- Pagination ----------

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ---------- Types ----------

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
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
export type LectureProposalInput = z.infer<typeof LectureProposalSchema>;
export type LectureProposalsInput = z.infer<typeof LectureProposalsSchema>;
export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
export type GenerationPlanInput = z.infer<typeof GenerationPlanSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
