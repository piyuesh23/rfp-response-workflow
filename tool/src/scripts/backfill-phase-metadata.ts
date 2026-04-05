/**
 * Backfill metadata for existing PhaseArtefacts that have contentMd but no metadata.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-phase-metadata.ts
 *
 * Or inside Docker:
 *   docker compose exec app npx tsx src/scripts/backfill-phase-metadata.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import {
  extractAssessmentMetadata,
  extractEstimateMetadata,
  extractResearchMetadata,
} from "../lib/ai/metadata-extractor";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Backfilling phase artefact metadata...\n");

  const artefacts = await prisma.phaseArtefact.findMany({
    where: {
      metadata: { equals: Prisma.JsonNull },
      contentMd: { not: null },
    },
    select: {
      id: true,
      artefactType: true,
      contentMd: true,
    },
  });

  if (artefacts.length === 0) {
    console.log("No artefacts need backfilling. All done.");
    return;
  }

  console.log(`Found ${artefacts.length} artefact(s) to backfill:\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const artefact of artefacts) {
    if (!artefact.contentMd) {
      skipped++;
      continue;
    }

    try {
      let metadata: Record<string, unknown> | null = null;

      switch (artefact.artefactType) {
        case "TOR_ASSESSMENT":
          metadata = extractAssessmentMetadata(artefact.contentMd) as unknown as Record<string, unknown>;
          break;
        case "ESTIMATE":
          metadata = extractEstimateMetadata(artefact.contentMd) as unknown as Record<string, unknown>;
          break;
        case "RESEARCH":
          metadata = extractResearchMetadata(artefact.contentMd) as unknown as Record<string, unknown>;
          break;
        default:
          skipped++;
          continue;
      }

      if (metadata) {
        await prisma.phaseArtefact.update({
          where: { id: artefact.id },
          data: { metadata: JSON.parse(JSON.stringify(metadata)) },
        });
        console.log(`  UPDATED  ${artefact.id} (${artefact.artefactType})`);
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(
        `  ERROR  ${artefact.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      errors++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
