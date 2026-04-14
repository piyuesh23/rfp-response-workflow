/**
 * Convert raw extracted text (from PDF/DOCX) into clean, structured markdown.
 * Uses Haiku for fast, cost-efficient formatting. Sonnet was tried but hit SDK
 * request timeouts on large outputs; Haiku completes chunks quickly and the
 * chunking strategy already solves the real quality issue (truncation at the
 * input boundary). Handles arbitrarily long documents by chunking at paragraph
 * boundaries.
 */
import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 8000;

// Chunk size tuned so each chunk fits within Haiku's 8k output token budget.
// ~25k chars in ≈ ~7k tokens out when expanded with markdown structure.
const CHUNK_CHAR_SIZE = 25000;
const MIN_TEXT_LENGTH = 100;

/**
 * Split long text into chunks that break at paragraph or line boundaries
 * to avoid cutting tables or sentences mid-flow.
 */
function chunkText(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Back off to the nearest paragraph break (then line break) in the
    // second half of the chunk, so boundaries don't bisect logical blocks.
    if (end < text.length) {
      const minEnd = start + Math.floor(chunkSize / 2);
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > minEnd) {
        end = paragraphBreak;
      } else {
        const lineBreak = text.lastIndexOf("\n", end);
        if (lineBreak > minEnd) end = lineBreak;
      }
    }

    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

async function convertChunk(
  text: string,
  documentType: string,
  label: string,
  chunkIndex: number,
  totalChunks: number,
  anthropic: Anthropic
): Promise<string> {
  const chunkContext =
    totalChunks > 1
      ? `\n\nThis is chunk ${chunkIndex + 1} of ${totalChunks} from a larger document. Format only the content provided below. Do not add a summary, table of contents, or cross-chunk commentary.`
      : "";

  const systemPrompt = `You are a document formatter. Convert the raw extracted text into clean, well-structured markdown.

Rules:
- Preserve ALL content — do not summarize, omit, or rephrase. Keep every detail.
- Add proper markdown headings (##, ###) based on document structure
- Format lists as bullet points or numbered lists
- Format tabular data as markdown tables
- Clean up artifacts from PDF extraction (broken lines, stray characters, page numbers)
- Remove duplicate headers/footers that repeat across pages
- Fix word splits caused by line breaks (e.g., "imple-\\nmentation" → "implementation")
- Keep the original document's section ordering

The document type is: ${documentType}
The document label is: ${label}${chunkContext}`;

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Convert this raw extracted text to clean markdown:\n\n${text}`,
      },
    ],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";
  return responseText || text;
}

/**
 * Convert raw extracted document text into well-structured markdown.
 * Preserves all content but adds proper headings, lists, tables, and formatting.
 * Long documents are chunked and processed sequentially, then concatenated.
 */
export async function convertToMarkdown(
  rawText: string,
  documentType: string,
  label: string
): Promise<string> {
  if (!rawText || rawText.length < MIN_TEXT_LENGTH) return rawText;

  const chunks = chunkText(rawText, CHUNK_CHAR_SIZE);
  const anthropic = new Anthropic();

  try {
    if (chunks.length === 1) {
      return await convertChunk(chunks[0], documentType, label, 0, 1, anthropic);
    }

    const results: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const converted = await convertChunk(
        chunks[i],
        documentType,
        label,
        i,
        chunks.length,
        anthropic
      );
      results.push(converted);
    }
    return results.join("\n\n");
  } catch (err) {
    console.warn(
      `[markdown-converter] Conversion failed (${chunks.length} chunk(s), ${rawText.length} chars): ${err instanceof Error ? err.message : String(err)}`
    );
    return rawText;
  }
}
