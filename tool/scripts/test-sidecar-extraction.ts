/**
 * Smoke test for sidecar extractors.
 *
 * Runs mock markdown samples through the Phase 1 and Estimate sidecar
 * extractors and prints the parsed objects. Does NOT hit the database.
 *
 * Usage:  cd tool && npx tsx scripts/test-sidecar-extraction.ts
 */
import {
  extractPhase1Sidecar,
  extractEstimateSidecar,
  normalizeClauseRef,
} from "../src/lib/ai/sidecar-extractors";

const PHASE1_FIXTURE = `# TOR Assessment

## Requirements Assessment
| Requirement ID | Domain | Description | Clarity Rating | Notes |
| --- | --- | --- | --- | --- |
| 3.2.1 | integration | Content syndication across sites | Clear | — |
| 4.1   | frontend    | Component-based UI                | Ambiguous | Missing design system |

## Clarity Assessment Summary
| Clarity Rating | Count | Percentage |
| --- | --- | --- |
| Clear | 1 | 50% |

<!-- PHASE1-REQUIREMENTS-JSON
{
  "requirements": [
    {
      "clauseRef": "3.2.1",
      "title": "Content syndication",
      "description": "Multi-site syndication service with content API.",
      "domain": "integration",
      "clarityRating": "CLEAR"
    },
    {
      "clauseRef": "Section 4.1",
      "title": "Component-based UI",
      "description": "Frontend component library.",
      "domain": "frontend",
      "clarityRating": "AMBIGUOUS"
    }
  ]
}
-->
`;

const ESTIMATE_FIXTURE = `# Optimistic Estimate

## Backend Tab
| Task | ... | Hours | Conf | Low | High |
| --- | --- | --- | --- | --- | --- |
| Content API | ... | 40 | 5 | 40 | 50 |

<!-- ESTIMATE-LINEITEMS-JSON
{
  "lineItems": [
    {
      "tab": "BACKEND",
      "task": "Content API",
      "description": "Covers §3.2.1.",
      "hours": 40,
      "conf": 5,
      "lowHrs": 40,
      "highHrs": 50,
      "benchmarkRef": "backend.api.medium",
      "integrationTier": null,
      "torClauseRefs": ["3.2.1"],
      "orphanJustification": null
    },
    {
      "tab": "FIXED_COST",
      "task": "Deployment pipeline",
      "description": "CI/CD wiring.",
      "hours": 16,
      "conf": 6,
      "lowHrs": 16,
      "highHrs": 16,
      "benchmarkRef": null,
      "integrationTier": null,
      "torClauseRefs": [],
      "orphanJustification": "Cross-cutting DevOps task."
    }
  ]
}
-->
`;

const MALFORMED_FIXTURE = `# Broken

<!-- PHASE1-REQUIREMENTS-JSON
{ "requirements": [ { "clauseRef": "x", "title": "x" } }
-->
`;

const MISSING_SIDECAR_FIXTURE = `# No sidecar here, should return null.`;

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK:   ${msg}`);
}

function main(): void {
  console.log("=== Phase 1 sidecar ===");
  const p1 = extractPhase1Sidecar(PHASE1_FIXTURE);
  assert(p1 !== null, "Phase 1 sidecar parsed");
  assert(p1?.requirements.length === 2, "Phase 1 sidecar has 2 requirements");
  assert(p1?.requirements[0].clauseRef === "3.2.1", "clauseRef preserved");
  assert(p1?.requirements[0].domain === "integration", "domain enum preserved");
  assert(
    p1?.requirements[1].clarityRating === "AMBIGUOUS",
    "clarityRating enum preserved"
  );
  assert(
    normalizeClauseRef("Section 4.1") === "section4.1",
    "normalizeClauseRef lowercases + strips whitespace"
  );

  console.log("\n=== Estimate sidecar ===");
  const est = extractEstimateSidecar(ESTIMATE_FIXTURE);
  assert(est !== null, "Estimate sidecar parsed");
  assert(est?.lineItems.length === 2, "Estimate sidecar has 2 line items");
  assert(est?.lineItems[0].tab === "BACKEND", "tab parsed");
  assert(est?.lineItems[0].torClauseRefs.length === 1, "torClauseRefs parsed");
  assert(
    est?.lineItems[1].orphanJustification === "Cross-cutting DevOps task.",
    "orphanJustification parsed"
  );
  assert(est?.lineItems[1].integrationTier === null, "integrationTier null");

  console.log("\n=== Malformed sidecar ===");
  const bad = extractPhase1Sidecar(MALFORMED_FIXTURE);
  assert(bad === null, "Malformed sidecar returns null (no crash)");

  console.log("\n=== Missing sidecar ===");
  const none = extractPhase1Sidecar(MISSING_SIDECAR_FIXTURE);
  assert(none === null, "Missing sidecar returns null");
  const noneEst = extractEstimateSidecar(MISSING_SIDECAR_FIXTURE);
  assert(noneEst === null, "Missing estimate sidecar returns null");

  console.log("\nAll sidecar extractor smoke tests passed.");
}

main();
