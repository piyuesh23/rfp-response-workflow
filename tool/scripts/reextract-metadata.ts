/**
 * One-off script to re-extract metadata for a specific engagement.
 * Reads actual artefact files from disk, updates DB contentMd and metadata,
 * and imports risk-register.csv into RiskRegisterEntry table.
 *
 * Usage: npx tsx scripts/reextract-metadata.ts <engagementId>
 */

import { prisma } from "../src/lib/db";
import { extractMetadataForPhase } from "../src/lib/ai/metadata-extractor";
import * as fs from "fs/promises";
import * as path from "path";

const ENGAGEMENT_ID = process.argv[2];
if (!ENGAGEMENT_ID) {
  console.error("Usage: npx tsx scripts/reextract-metadata.ts <engagementId>");
  process.exit(1);
}

const DATA_DIR = `/data/engagements/${ENGAGEMENT_ID}`;

// Map phase numbers to their primary output file paths
const PHASE_OUTPUT_FILES: Record<string, string[]> = {
  "0": ["research/customer-research.md"],
  "1": ["claude-artefacts/tor-assessment.md"],
  "1A": ["estimates/optimistic-estimate.md"],
  "2": ["claude-artefacts/response-analysis.md"],
  "3": ["estimates/revised-estimate.md", "estimates/optimistic-estimate.md"],
  "3R": ["claude-artefacts/gap-analysis.md"],
  "5": ["claude-artefacts/technical-proposal.md"],
};

async function readFileContent(relPath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(path.join(DATA_DIR, relPath), "utf-8");
    return content.trim().length > 100 ? content : null;
  } catch {
    return null;
  }
}

async function reextractArtefacts() {
  console.log(`\n=== Re-extracting metadata for engagement ${ENGAGEMENT_ID} ===\n`);

  const phases = await prisma.phase.findMany({
    where: { engagementId: ENGAGEMENT_ID },
    include: {
      artefacts: { orderBy: { version: "desc" } },
    },
    orderBy: { phaseNumber: "asc" },
  });

  for (const phase of phases) {
    console.log(`Phase ${phase.phaseNumber} (${phase.status}):`);

    for (const artefact of phase.artefacts) {
      console.log(`  Artefact: ${artefact.artefactType} v${artefact.version}`);

      // Try to read actual file content
      const outputFiles = PHASE_OUTPUT_FILES[phase.phaseNumber] ?? [];
      let fileContent: string | null = null;

      for (const relPath of outputFiles) {
        fileContent = await readFileContent(relPath);
        if (fileContent) {
          console.log(`    Found file: ${relPath} (${fileContent.length} chars)`);
          break;
        }
      }

      // Check if DB content needs updating
      const dbContent = artefact.contentMd ?? "";
      const dbHasRealContent = dbContent.length > 1000; // Summary is ~2K, real content is 10K+
      const fileIsBetter = fileContent && fileContent.length > dbContent.length;

      let contentToUse = dbContent;
      let contentUpdated = false;

      if (fileIsBetter) {
        contentToUse = fileContent!;
        contentUpdated = true;
        console.log(`    Updating contentMd: ${dbContent.length} -> ${contentToUse.length} chars`);
      } else if (dbHasRealContent) {
        console.log(`    DB content looks good (${dbContent.length} chars)`);
      } else {
        console.log(`    WARNING: No good content source found`);
      }

      // Re-extract metadata from the best content
      const freshMeta = extractMetadataForPhase(phase.phaseNumber, contentToUse);
      if (freshMeta) {
        console.log(`    Metadata: ${JSON.stringify(freshMeta).substring(0, 200)}...`);
      }

      // Update DB
      const updateData: Record<string, unknown> = {};
      if (contentUpdated) updateData.contentMd = contentToUse;
      if (freshMeta) updateData.metadata = JSON.parse(JSON.stringify(freshMeta));

      if (Object.keys(updateData).length > 0) {
        await prisma.phaseArtefact.update({
          where: { id: artefact.id },
          data: updateData,
        });
        console.log(`    Updated in DB`);
      }
    }
  }
}

async function fixResearchMetadata() {
  console.log(`\n=== Fixing research metadata from CSVs ===\n`);

  const csvDir = path.join(DATA_DIR, "research/csv");

  // Count lines (minus header) in relevant CSVs
  async function countCsvRows(filename: string): Promise<number> {
    try {
      const content = await fs.readFile(path.join(csvDir, filename), "utf-8");
      const lines = content.trim().split("\n");
      return Math.max(0, lines.length - 1); // subtract header
    } catch {
      return 0;
    }
  }

  const integrationsFound = await countCsvRows("third-party-integrations.csv");
  const hiddenScopeItems = await countCsvRows("hidden-scope.csv");
  const riskCount = await countCsvRows("risk-register.csv");

  console.log(`  Integrations: ${integrationsFound}, Hidden scope: ${hiddenScopeItems}, Risks: ${riskCount}`);

  // Update the RESEARCH artefact metadata
  const researchArtefact = await prisma.phaseArtefact.findFirst({
    where: {
      phase: { engagementId: ENGAGEMENT_ID, phaseNumber: "0" },
      artefactType: "RESEARCH",
    },
    select: { id: true },
  });

  if (researchArtefact) {
    await prisma.phaseArtefact.update({
      where: { id: researchArtefact.id },
      data: {
        metadata: JSON.parse(JSON.stringify({ integrationsFound, hiddenScopeItems, riskCount })),
      },
    });
    console.log(`  Updated RESEARCH metadata in DB`);
  }
}

async function importRiskRegisterCsv() {
  console.log(`\n=== Importing risk-register.csv ===\n`);

  const csvPath = path.join(DATA_DIR, "research/csv/risk-register.csv");
  let csvContent: string;
  try {
    csvContent = await fs.readFile(csvPath, "utf-8");
  } catch {
    console.log("  risk-register.csv not found — skipping");
    return;
  }

  // Parse CSV
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    console.log("  CSV has no data rows — skipping");
    return;
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  console.log(`  Headers: ${headers.join(", ")}`);

  // Map CSV columns
  const colIdx = {
    riskId: headers.findIndex((h) => h.toLowerCase().includes("risk_id")),
    category: headers.findIndex((h) => h.toLowerCase().includes("category")),
    description: headers.findIndex((h) => h.toLowerCase().includes("description")),
    probability: headers.findIndex((h) => h.toLowerCase().includes("probability")),
    impact: headers.findIndex((h) => h.toLowerCase().includes("impact") && !h.toLowerCase().includes("cost") && !h.toLowerCase().includes("timeline")),
    riskLevel: headers.findIndex((h) => h.toLowerCase().includes("risk_level") || h.toLowerCase().includes("level")),
    mitigation: headers.findIndex((h) => h.toLowerCase().includes("mitigation")),
    owner: headers.findIndex((h) => h.toLowerCase().includes("owner")),
  };

  // Clear existing risks for this engagement
  const deleted = await prisma.riskRegisterEntry.deleteMany({
    where: { engagementId: ENGAGEMENT_ID },
  });
  console.log(`  Cleared ${deleted.count} existing risk entries`);

  // Map risk level to conf score (inverse: High risk = Low conf)
  function riskLevelToConf(level: string): number {
    const l = level.toLowerCase().trim();
    if (l === "critical" || l === "very high") return 1;
    if (l === "high") return 2;
    if (l === "medium") return 3;
    if (l === "low") return 5;
    if (l === "very low") return 6;
    return 3; // default medium
  }

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with commas inside fields (simple approach)
    const cells = lines[i].split(",").map((c) => c.trim());
    if (cells.length < 3) continue;

    const riskLevel = colIdx.riskLevel >= 0 ? cells[colIdx.riskLevel] : "Medium";
    const conf = riskLevelToConf(riskLevel);

    await prisma.riskRegisterEntry.create({
      data: {
        engagementId: ENGAGEMENT_ID,
        task: colIdx.riskId >= 0 ? cells[colIdx.riskId] : `Risk-${i}`,
        tab: colIdx.category >= 0 ? cells[colIdx.category] : "General",
        conf,
        risk: colIdx.description >= 0 ? cells[colIdx.description] : cells[1] ?? "",
        openQuestion: colIdx.mitigation >= 0 ? cells[colIdx.mitigation] : "",
        recommendedAction: colIdx.owner >= 0 ? cells[colIdx.owner] : "",
        hoursAtRisk: 0, // CSV doesn't have hours — will be enriched later
      },
    });
    imported++;
  }

  console.log(`  Imported ${imported} risk register entries`);
}

async function main() {
  try {
    await reextractArtefacts();
    await fixResearchMetadata();
    await importRiskRegisterCsv();

    // Verify final state
    console.log(`\n=== Verification ===\n`);
    const stats = await prisma.riskRegisterEntry.count({
      where: { engagementId: ENGAGEMENT_ID },
    });
    console.log(`  Risk entries in DB: ${stats}`);

    const artefacts = await prisma.phaseArtefact.findMany({
      where: { phase: { engagementId: ENGAGEMENT_ID } },
      select: { artefactType: true, metadata: true },
    });
    for (const a of artefacts) {
      const meta = a.metadata as Record<string, unknown> | null;
      console.log(`  ${a.artefactType}: ${meta ? JSON.stringify(meta).substring(0, 120) : "no metadata"}...`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
