import { NextRequest } from "next/server";
import { requireTeacher } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { AppError, ValidationError } from "@/lib/utils/errors";
import { bulkCreateQuestions } from "@/lib/services/question-bank.service";
import { logger } from "@/lib/utils/logger";
import { parse as csvParse } from "csv-parse/sync";
import * as XLSX from "xlsx";

type RawRow = Record<string, string>;

const VALID_TYPES = new Set(["MCQ", "SHORT_ANSWER", "CALCULATION"]);

function parseRow(row: RawRow, rowIndex: number): {
  type: "MCQ" | "SHORT_ANSWER" | "CALCULATION";
  content: Record<string, unknown>;
} {
  const type = (row.type ?? row.Type ?? "").trim().toUpperCase() as RawRow["type"];
  const prompt = (row.prompt ?? row.question ?? row.Question ?? "").trim();
  const explanation = (row.explanation ?? row.Explanation ?? "").trim() || undefined;
  const correctAnswer = (row.correct_answer ?? row.correctAnswer ?? row["correct answer"] ?? "").trim();

  if (!VALID_TYPES.has(type)) {
    throw new ValidationError(
      `Row ${rowIndex + 1}: invalid type "${type}". Must be one of: MCQ, SHORT_ANSWER, CALCULATION.`
    );
  }

  if (!prompt) {
    throw new ValidationError(`Row ${rowIndex + 1}: prompt/question field is required.`);
  }

  if (type === "MCQ") {
    let options: string[];
    const rawOptions = (row.options ?? row.Options ?? "").trim();
    if (!rawOptions) {
      throw new ValidationError(`Row ${rowIndex + 1}: options field is required for MCQ.`);
    }
    // Try JSON array first, then fall back to pipe-separated
    try {
      options = JSON.parse(rawOptions);
      if (!Array.isArray(options)) throw new Error("not an array");
    } catch {
      options = rawOptions.split("|").map((o) => o.trim()).filter(Boolean);
    }

    const correctIndex = Number(row.correct_option_index ?? row.correctOptionIndex ?? correctAnswer);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      throw new ValidationError(
        `Row ${rowIndex + 1}: correct_option_index is out of range for MCQ options.`
      );
    }

    return {
      type: "MCQ",
      content: {
        type: "MCQ",
        prompt,
        options,
        correctOptionIndex: correctIndex,
        ...(explanation ? { explanation } : {}),
      } as Record<string, unknown>,
    };
  }

  if (type === "SHORT_ANSWER") {
    if (!correctAnswer) {
      throw new ValidationError(`Row ${rowIndex + 1}: correct_answer is required for SHORT_ANSWER.`);
    }
    return {
      type: "SHORT_ANSWER",
      content: {
        type: "SHORT_ANSWER",
        prompt,
        correctAnswer,
        ...(explanation ? { explanation } : {}),
      } as Record<string, unknown>,
    };
  }

  // CALCULATION
  const variablesRaw = (row.variables ?? row.Variables ?? "").trim();
  const formula = (row.formula ?? row.Formula ?? correctAnswer).trim();

  let variables: { name: string; min: number; max: number; decimals?: number }[];
  try {
    variables = JSON.parse(variablesRaw);
    if (!Array.isArray(variables) || !variables.every(isVariableDef)) {
      throw new Error("invalid variables");
    }
  } catch {
    throw new ValidationError(
      `Row ${rowIndex + 1}: variables must be a JSON array of {name, min, max, decimals?}.`
    );
  }

  if (!formula) {
    throw new ValidationError(`Row ${rowIndex + 1}: formula is required for CALCULATION.`);
  }

  return {
    type: "CALCULATION",
    content: {
      type: "CALCULATION",
      promptTemplate: prompt,
      variables,
      answerFormula: formula,
      ...(explanation ? { explanation } : {}),
    } as Record<string, unknown>,
  };
}

function isVariableDef(v: unknown): v is { name: string; min: number; max: number; decimals?: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    "name" in v &&
    "min" in v &&
    "max" in v
  );
}

function parseFile(buffer: Buffer): RawRow[] {
  // Try XLSX first
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: RawRow[] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as RawRow[];
    if (rows.length < 2) throw new Error("empty sheet");
    const headers = (rows[0] as unknown as string[]).map((h) => String(h).trim());
    return rows.slice(1).filter((r) => r.some((cell) => cell !== undefined && cell !== ""));
  } catch {
    // Fall back to CSV
  }

  const text = buffer.toString("utf-8");
  const records: RawRow[] = csvParse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relaxColumnCount: true,
  });
  return records;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireTeacher();

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      throw new ValidationError("A file is required.");
    }

    const ext = (file.name ?? "").toLowerCase().split(".").pop();
    if (ext && !["csv", "xlsx", "xls"].includes(ext)) {
      throw new ValidationError("File must be a .csv, .xlsx, or .xls file.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseFile(buffer);

    if (rows.length === 0) {
      throw new ValidationError("The file contains no data rows.");
    }

    const questions: Array<{ type: "MCQ" | "SHORT_ANSWER" | "CALCULATION"; content: Record<string, unknown> }> = [];

    for (let i = 0; i < rows.length; i++) {
      questions.push(parseRow(rows[i], i));
    }

    const result = await bulkCreateQuestions(quizId, session.userId, questions);

    logger.info("question_bank.upload", {
      userId: session.userId,
      quizId,
      count: result.count,
    });

    return Response.json(
      { data: { count: result.count }, message: `${result.count} question(s) imported successfully.` },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
