import { z } from "zod";
import { Role, QuestionType, QuestionStatus } from "@prisma/client";

// ---------- Shared Json types ----------

export interface SourceRef {
  materialId: string;
  startPage: number;
  endPage: number;
}

export const SourceRefSchema: z.ZodType<SourceRef> = z.object({
  materialId: z.string().cuid("ID tài liệu không hợp lệ"),
  startPage: z.number().int().min(1, "Trang đầu phải bắt đầu từ 1"),
  endPage: z.number().int().min(1, "Trang cuối phải bắt đầu từ 1"),
}).refine((data) => data.endPage >= data.startPage, {
  message: "Trang cuối phải lớn hơn hoặc bằng trang đầu",
});

// ---------- Auth ----------

export const SignupSchema = z.object({
  name: z.string().min(1, "Cần có tên").max(100),
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(100),
  role: z.nativeEnum(Role),
});

export const LoginSchema = z.object({
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z.string().min(1, "Cần có mật khẩu"),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Cần có tên").max(100),
  email: z.string().email("Địa chỉ email không hợp lệ"),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Cần có mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(100),
});

// ---------- Classes ----------

export const CreateClassSchema = z.object({
  name: z.string().min(1, "Cần có tên lớp").max(100),
  description: z.string().max(500).optional(),
  classPassword: z.string().min(4, "Mật khẩu phải có ít nhất 4 ký tự").max(50),
});

export const UpdateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  classPassword: z
    .string()
    .min(4, "Mật khẩu phải có ít nhất 4 ký tự")
    .max(50)
    .optional(),
});

export const JoinClassSchema = z.object({
  classCode: z.string().min(1, "Cần có mã lớp"),
  classPassword: z.string().min(1, "Cần có mật khẩu lớp"),
});

// ---------- Lectures ----------

export const CreateLectureSchema = z.object({
  classId: z.string().cuid("ID lớp không hợp lệ"),
  title: z.string().min(1, "Cần có tiêu đề").max(200),
  sourceRef: SourceRefSchema.optional().nullable(),
  materialId: z.string().cuid("ID tài liệu không hợp lệ").optional().nullable(),
  order: z.number().int().positive().optional(),
});

export const UpdateLectureSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  sourceRef: SourceRefSchema.optional().nullable(),
  order: z.number().int().positive().optional(),
  materialId: z.string().cuid("ID tài liệu không hợp lệ").optional().nullable(),
});

// ---------- Quizzes ----------

export const CreateQuizSchema = z.object({
  lectureId: z.string().cuid("ID buổi giảng không hợp lệ"),
  instructions: z.string().min(1, "Cần có hướng dẫn").max(5000),
  questionsPerAttempt: z
    .number()
    .int()
    .min(1, "Cần ít nhất 1 câu hỏi mỗi lượt làm bài")
    .max(100),
  timeLimitMinutes: z
    .number()
    .int()
    .min(1, "Thời gian tối thiểu phải là 1 phút")
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
  deadline: z.string().datetime("Định dạng hạn chót không hợp lệ"),
});

// ---------- Question Bank ----------

const MCQContentSchema = z.object({
  type: z.literal("MCQ"),
  prompt: z.string().min(1, "Cần có nội dung câu hỏi"),
  options: z
    .array(z.string().min(1))
    .min(2, "Cần ít nhất 2 đáp án")
    .max(10),
  correctOptionIndex: z
    .number()
    .int()
    .min(0, "correctOptionIndex không được âm"),
  explanation: z.string().optional(),
});

const ShortAnswerContentSchema = z.object({
  type: z.literal("SHORT_ANSWER"),
  prompt: z.string().min(1, "Cần có nội dung câu hỏi"),
  correctAnswer: z.string().min(1, "Cần có đáp án đúng"),
  explanation: z.string().optional(),
});

const CalculationContentSchema = z.object({
  type: z.literal("CALCULATION"),
  promptTemplate: z.string().min(1, "Cần có mẫu câu hỏi"),
  variables: z
    .array(
      z.object({
        name: z.string().min(1),
        min: z.number(),
        max: z.number(),
        decimals: z.number().int().min(0).max(10).optional(),
      })
    )
    .min(1, "Cần ít nhất 1 biến"),
  answerFormula: z.string().min(1, "Cần có công thức tính đáp án"),
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
  text: z.string().min(1, "Cần có nội dung câu trả lời"),
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
  quizId: z.string().cuid("ID bài kiểm tra không hợp lệ"),
});

export const SaveAnswerSchema = z.object({
  answers: z.array(
    z.object({
      questionBankItemId: z.string().cuid("ID câu hỏi không hợp lệ"),
      partialAnswer: z.boolean().optional(),
      answer: StudentAnswerValueSchema,
    })
  ),
});

export const SubmitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionBankItemId: z.string().cuid("ID câu hỏi không hợp lệ"),
        answer: StudentAnswerValueSchema,
      })
    )
    .min(1, "Cần ít nhất một câu trả lời"),
});

// ---------- Reports ----------

export const CreateReportSchema = z.object({
  studentAnswerId: z.string().cuid("ID câu trả lời không hợp lệ"),
  description: z.string().min(10, "Mô tả phải có ít nhất 10 ký tự").max(1000),
});

// ---------- Lecture planning chat ----------

export const LectureProposalSchema = z.object({
  title: z.string().min(1, "Cần có tiêu đề").max(200),
  startPage: z.number().int().min(0).max(100000),
  endPage: z.number().int().min(0).max(100000),
  description: z.string().max(1000).optional(),
});

export const LectureProposalsSchema = z
  .array(LectureProposalSchema)
  .min(1, "Cần ít nhất một đề xuất buổi giảng")
  .max(50, "Quá nhiều đề xuất buổi giảng");

/**
 * Shape of a lecture produced by the AI when a plan is confirmed.
 *
 * The values come straight from a language model, so every field is
 * coerced: models routinely send page numbers and counts as strings. Anything
 * that cannot be coerced is rejected, which keeps malformed values away
 * from the database.
 */
export const LectureFormatSchema = z.object({
  title: z.string().trim().min(1, "Cần có tiêu đề buổi giảng").max(200),
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

/**
 * A single type + difficulty group of questions. The client asks for one
 * bucket per request so that every request stays inside the serverless
 * time limit.
 */
export const BucketSchema = z.object({
  type: z.enum(["MCQ", "SHORT_ANSWER", "CALCULATION"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  /**
   * How many questions this bucket asks for. The client splits a plan into
   * small calls - a model that has to write 5-7 questions in one answer
   * regularly needs longer than the request budget allows.
   */
  count: z.number().int().min(1).max(5).optional(),
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
