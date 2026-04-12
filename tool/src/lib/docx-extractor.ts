/**
 * DOCX text extraction utility using mammoth.
 */

export interface DocxExtractionResult {
  text: string;
  html: string;
}

/**
 * Extract text content from a DOCX buffer.
 */
export async function extractTextFromDocx(
  buffer: Buffer
): Promise<DocxExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as typeof import("mammoth");

  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);

  return {
    text: textResult.value,
    html: htmlResult.value,
  };
}

/**
 * Check if a filename is a DOCX file.
 */
export function isDocx(filename: string): boolean {
  return filename.toLowerCase().endsWith(".docx");
}
