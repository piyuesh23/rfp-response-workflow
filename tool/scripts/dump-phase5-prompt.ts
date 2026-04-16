/**
 * Dump Phase 5 Section 4.3 content for each EngagementType.
 *
 * Verifies that getSection43Block produces a distinct heading and
 * directive for each of the five engagement types.
 *
 * Usage:  cd tool && npx tsx scripts/dump-phase5-prompt.ts
 */
import { getSection43Block } from "../src/lib/ai/phases/phase5-capture";

const ENGAGEMENT_TYPES = [
  "MIGRATION",
  "REDESIGN",
  "NEW_BUILD",
  "ENHANCEMENT",
  "DISCOVERY",
] as const;

for (const type of ENGAGEMENT_TYPES) {
  const block = getSection43Block(type);
  console.log("=".repeat(80));
  console.log(`EngagementType: ${type}`);
  console.log("-".repeat(80));
  console.log(`Heading:  #### ${block.title}`);
  console.log("-".repeat(80));
  console.log("Directive:");
  console.log(block.directive);
  console.log();
}
