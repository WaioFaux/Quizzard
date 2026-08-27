import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";

export interface ExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    creationDate?: Date;
  };
}

const UPLOAD_DIR = process.env.FILE_STORAGE_PATH ?? "./public/uploads";

export async function extractTextFromPDF(filePath: string): Promise<ExtractionResult> {
  // Handle both absolute paths and relative filenames
  let absolutePath = filePath;
  if (!path.isAbsolute(filePath)) {
    absolutePath = path.resolve(UPLOAD_DIR, filePath);
  }

  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`PDF file not found: ${absolutePath}`);
  }

  const pdfBuffer = await fs.readFile(absolutePath);
  const parsed = await pdfParse(pdfBuffer);

  return {
    text: parsed.text,
    pageCount: parsed.numpages,
    metadata: {
      title: parsed.info?.Title,
      author: parsed.info?.Author,
      creationDate: parsed.info?.CreationDate
        ? new Date(parsed.info.CreationDate)
        : undefined,
    },
  };
}

export async function extractTextFromPDFBuffer(buffer: Buffer): Promise<ExtractionResult> {
  const parsed = await pdfParse(buffer);

  return {
    text: parsed.text,
    pageCount: parsed.numpages,
    metadata: {
      title: parsed.info?.Title,
      author: parsed.info?.Author,
      creationDate: parsed.info?.CreationDate
        ? new Date(parsed.info.CreationDate)
        : undefined,
    },
  };
}

export function truncateText(text: string, maxLength: number = 100000): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + "\n\n[Content truncated due to length...]";
}
