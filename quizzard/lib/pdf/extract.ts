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

/**
 * Extracts text from an in-memory PDF buffer.
 * Buffers are used instead of file paths because the app runs on serverless
 * functions where the local filesystem is not writable.
 */
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
