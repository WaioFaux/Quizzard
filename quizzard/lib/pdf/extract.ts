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
  // Copy the bytes into a standalone Uint8Array first. A Node Buffer is a
  // view into a shared pool, so `buffer.buffer` may contain unrelated bytes
  // before the start of the file. The bundled pdf.js reads the underlying
  // ArrayBuffer and ignores the view offset, which corrupts the xref table
  // and makes perfectly valid PDFs fail with "bad XRef entry".
  const bytes = new Uint8Array(buffer);

  const parsed = await pdfParse(bytes as unknown as Buffer);

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
