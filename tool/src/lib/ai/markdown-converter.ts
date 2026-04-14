/**
 * Convert raw extracted text (from PDF/DOCX) into clean, structured markdown.
 * Uses Haiku for cost-efficient formatting.
 */
import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/**
 * Convert raw extracted document text into well-structured markdown.
 * Preserves all content but adds proper headings, lists, tables, and formatting.
 */
export async function convertToMarkdown(
  rawText: string,
  documentType: string,
  label: string
): Promise<string> {
  if (!rawText || rawText.length < 100) return rawText;

  const truncated = rawText.slice(0, 30000);
  const anthropic = new Anthropic();

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
The document label is: ${label}`;

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Convert this raw extracted text to clean markdown:\n\n${truncated}`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    return responseText || rawText;
  } catch (err) {
    console.warn(
      `[markdown-converter] Conversion failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return rawText;
  }
}
