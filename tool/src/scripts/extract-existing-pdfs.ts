/**
 * One-time migration script: extract text from all existing TOR PDFs in MinIO.
 *
 * Usage:
 *   npx tsx src/scripts/extract-existing-pdfs.ts
 *
 * Or inside Docker:
 *   docker compose exec app npx tsx src/scripts/extract-existing-pdfs.ts
 *
 * Environment variables required: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 */

import { listObjects, downloadFile, uploadFile } from "../lib/storage";
import { isPdf, extractTextFromPdf, pdfTextToMarkdown } from "../lib/pdf-extractor";

async function main() {
  console.log("Scanning MinIO for existing TOR PDFs...\n");

  // List all objects under engagements/
  const allKeys = await listObjects("engagements/");

  // Filter to tor/ PDFs only
  const pdfKeys = allKeys.filter(
    (key) => key.includes("/tor/") && isPdf(key)
  );

  if (pdfKeys.length === 0) {
    console.log("No TOR PDFs found in MinIO. Nothing to do.");
    return;
  }

  console.log(`Found ${pdfKeys.length} PDF(s) to process:\n`);

  let extracted = 0;
  let skipped = 0;
  let errors = 0;

  for (const pdfKey of pdfKeys) {
    const mdKey = pdfKey.replace(/\.pdf$/i, ".md");

    // Check if .md already exists (idempotent)
    const existingKeys = await listObjects(mdKey);
    if (existingKeys.includes(mdKey)) {
      console.log(`  SKIP  ${pdfKey} (${mdKey} already exists)`);
      skipped++;
      continue;
    }

    try {
      console.log(`  EXTRACT  ${pdfKey}`);
      const buffer = await downloadFile(pdfKey);
      const result = await extractTextFromPdf(buffer);
      const markdown = pdfTextToMarkdown(result, pdfKey.split("/").pop() ?? "document.pdf");

      await uploadFile(mdKey, markdown, "text/markdown");

      console.log(
        `    -> ${mdKey} (${result.pageCount} pages, ${markdown.length} chars)`
      );
      extracted++;
    } catch (err) {
      console.error(
        `  ERROR  ${pdfKey}: ${err instanceof Error ? err.message : String(err)}`
      );
      errors++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Extracted: ${extracted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
