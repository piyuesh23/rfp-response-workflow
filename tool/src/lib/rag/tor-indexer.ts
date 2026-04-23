/**
 * TOR source file indexer — walks an engagement workDir's tor/ directory,
 * extracts text from PDF/DOCX, and pushes each file through indexArtefact.
 *
 * Extracted from phase-runner so it can run inside a dedicated RAG worker
 * without dragging in the phase execution pipeline.
 *
 * Non-fatal by design: errors are logged per file and swallowed so that a
 * single bad document does not abort indexing of the rest.
 */
import * as fs from "fs/promises";
import * as path from "path";

import { extractTextFromPdf } from "@/lib/pdf-extractor";
import { extractTextFromDocx } from "@/lib/docx-extractor";

import { indexArtefact } from "./store";

const RAG_MIN_CONTENT_LEN = 50;
/** Max chunks per TOR file — prevents very long documents from flooding the index. */
const TOR_MAX_CHUNKS = 40;
/** Max chars to send to indexArtefact for a single TOR file (≈ TOR_MAX_CHUNKS × 500). */
const TOR_MAX_CHARS = TOR_MAX_CHUNKS * 500;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function indexTorSourceFiles(
  engagementId: string,
  workDir: string
): Promise<void> {
  const torDir = path.join(workDir, "tor");
  let files: string[];
  try {
    files = await fs.readdir(torDir);
  } catch {
    return;
  }

  for (const filename of files) {
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) continue;

    try {
      const filePath = path.join(torDir, filename);
      const buffer = await fs.readFile(filePath);
      let text = "";
      let pageCount: number | undefined;

      if (lower.endsWith(".pdf")) {
        const result = await extractTextFromPdf(buffer);
        text = result.text;
        pageCount = result.pageCount;
      } else {
        const result = await extractTextFromDocx(buffer);
        text = result.text;
      }

      if (text.trim().length < RAG_MIN_CONTENT_LEN) continue;

      const cappedContent =
        text.length > TOR_MAX_CHARS ? text.slice(0, TOR_MAX_CHARS) : text;
      const sourceId = `tor-${slugify(filename)}`;

      await indexArtefact({
        engagementId,
        sourceType: "TOR_SOURCE",
        sourceId,
        content: cappedContent,
        metadata: {
          filename,
          mimeType: lower.endsWith(".pdf")
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ...(pageCount != null ? { pageCount } : {}),
        },
      });
      console.log(
        `[rag-index] Indexed TOR_SOURCE: ${filename} (${cappedContent.length} chars)`
      );
    } catch (err) {
      console.warn(
        `[rag-index] Failed to index TOR source ${filename}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
