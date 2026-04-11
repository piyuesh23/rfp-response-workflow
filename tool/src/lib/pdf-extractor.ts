/**
 * PDF text extraction utility.
 * Extracts text content from PDF buffers and provides structured output.
 */

type PdfParseFn = (buffer: Buffer) => Promise<{
  text: string;
  numpages: number;
  info: Record<string, string>;
}>;

// Import pdf-parse/lib/pdf-parse directly to bypass the entry point's
// test-file read (index.js reads ./test/data/05-versions-space.pdf when
// module.parent is falsy, which happens in Turbopack/Next.js bundling)
let _pdfParse: PdfParseFn | undefined;
function getPdfParse(): PdfParseFn {
  if (!_pdfParse) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _pdfParse = require("pdf-parse/lib/pdf-parse") as PdfParseFn;
  }
  return _pdfParse;
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  info: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

const MAX_PDF_SIZE = 30 * 1024 * 1024; // 30MB

/**
 * Extract text content from a PDF buffer.
 * Returns structured result with text, page count, and metadata.
 */
export async function extractTextFromPdf(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  if (buffer.length > MAX_PDF_SIZE) {
    throw new Error(
      `PDF exceeds maximum size of ${MAX_PDF_SIZE / 1024 / 1024}MB`
    );
  }

  const data = await getPdfParse()(buffer);

  return {
    text: data.text,
    pageCount: data.numpages,
    info: {
      title: data.info?.Title || undefined,
      author: data.info?.Author || undefined,
      subject: data.info?.Subject || undefined,
    },
  };
}

/**
 * Convert extracted PDF text to a markdown document with metadata header.
 */
export function pdfTextToMarkdown(
  result: PdfExtractionResult,
  originalFilename: string
): string {
  const lines: string[] = [];

  lines.push(`<!-- Auto-extracted from: ${originalFilename} -->`);
  lines.push(`<!-- Pages: ${result.pageCount} -->`);
  if (result.info.title) {
    lines.push(`<!-- Title: ${result.info.title} -->`);
  }
  lines.push("");

  // Use title from PDF metadata if available, otherwise derive from filename
  const title =
    result.info.title ||
    originalFilename.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(result.text);

  return lines.join("\n");
}

/**
 * Check if a filename is a PDF.
 */
export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}
