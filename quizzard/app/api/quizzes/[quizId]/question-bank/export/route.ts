import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { listQuestions } from "@/lib/services/question-bank.service";

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if contains comma, newline, or quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(
  type: string,
  content: Record<string, unknown>
): Record<string, string> {
  const base: Record<string, string> = {
    type,
    prompt: String(content.prompt ?? content.promptTemplate ?? ""),
    explanation: String(content.explanation ?? ""),
  };

  if (type === "MCQ") {
    base.options = JSON.stringify(content.options ?? []);
    base.correct_option_index = String(content.correctOptionIndex ?? 0);
  } else if (type === "SHORT_ANSWER") {
    base.correct_answer = String(content.correctAnswer ?? "");
  } else if (type === "CALCULATION") {
    base.variables = JSON.stringify(content.variables ?? []);
    base.formula = String(content.answerFormula ?? content.correctAnswer ?? "");
  }

  return base;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();

    const questions = await listQuestions(quizId, session.userId);

    const headers = [
      "type",
      "prompt",
      "options",
      "correct_option_index",
      "correct_answer",
      "variables",
      "formula",
      "explanation",
    ];

    const rows = questions.map((q) => {
      const content = q.content as Record<string, unknown>;
      const row = buildCsvRow(q.type, content);
      return headers.map((h) => escapeCsvValue(row[h])).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="question-bank-${quizId}.csv"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
