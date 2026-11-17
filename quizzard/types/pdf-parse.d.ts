declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    info?: {
      Title?: string;
      Author?: string;
      CreationDate?: Date;
      [key: string]: unknown;
    };
    metadata?: unknown;
    version?: string;
  }

  function pdfParse(data: Buffer | string): Promise<PDFData>;

  export default pdfParse;
}
