export function getCarlRules(): string {
  return `## CARL Presales Estimation Rules
These rules are always active and enforce estimation quality and consistency.

RULE 0: These rules enforce estimation quality and consistency across all presales engagements. They are always active.

RULE 1: ALWAYS check for commonly missing estimate categories: PM/Scrum, QA/testing, DevOps/CI-CD, content migration, training, documentation, UAT support, warranty/hypercare, environment setup.

RULE 2: ALWAYS rate every requirement for clarity using the scale: Clear / Needs Clarification / Ambiguous / Missing Detail.

RULE 3: NEVER generate generic questions like "can you elaborate?" — questions must be specific, reference the exact requirement, and propose concrete options (A/B/C).

RULE 4: ALWAYS map every TOR requirement to an estimate line item — flag unmapped requirements as GAPS.

RULE 5: ALWAYS flag estimate line items not traceable to any TOR requirement as ORPHANS.

RULE 6 (BENCHMARK COMPLIANCE): Every Backend and Frontend estimate line item MUST include a BenchmarkRef column value matching a BenchmarkKey from the Reference Benchmarks lookup table. Your Hours MUST fall within the LowHrs–HighHrs range for the matched benchmark. If Hours falls outside the range, add "BENCHMARK DEVIATION: [reason]" at the start of the Assumptions column. If no benchmark matches, write "N/A" in BenchmarkRef. Deviations > 25% from the mid-point require a written justification. A deviation summary section is REQUIRED at the end of the estimate.

RULE 7: Categorize requirements by domain: content architecture, integrations, migrations, frontend/theming, DevOps/hosting, SEO, accessibility, performance, security.

RULE 8: Document all assumptions (explicit and implicit) separately from requirements.

RULE 9: After completing any phase, suggest storing key learnings via claude-mem for future engagements.

RULE 10: Assumptions in estimate line items MUST reference only TOR sections/clauses or customer Q&A responses — NEVER reference internal analysis artifacts (assessment requirement IDs, task table entries, or claude-artefacts references).

RULE 11: Estimates MUST be organized into tabs: Backend (needs QA+PM), Frontend (component-level, needs QA+PM), Fixed Cost Items (no QA/PM — e.g., deployment, docs, training, onboarding), and AI (if applicable). NEVER place development tasks (content types, views, migrations, integrations) in Fixed Cost Items.

RULE 12: Frontend estimates MUST be at component level (Header, Footer, Card, Hero, etc.) with visual reference links. ALWAYS include a Design System line item (create new or reuse existing). When designs are unavailable, reference links to similar components on comparable sites are mandatory.

RULE 13: ALWAYS assign a Conf value (1-6) to every estimate line item based on requirement clarity AND confidence in the proposed solution. Target most items in the 4-6 range. If any item would fall below Conf 4, STOP and discuss with the user before finalizing — low confidence items need explicit alignment on assumptions or scope.

RULE 14: ALWAYS compute Low Hrs and High Hrs for every estimate line item using the Conf buffer formula: Conf 6=0%, 5=+25%, 4=+50%, 3=+50%, 2=+75%, 1=+100%. Low Hrs = base Hours, High Hrs = Hours × (1 + buffer%).

RULE 15: ALWAYS generate a Risk Register for all Conf ≤ 4 items with columns: Task, Tab, Conf, Risk/Dependency, Open Question for PM/Client, Recommended Action, Hours at Risk.

RULE 16: ALWAYS validate that always-include Backend tasks are present. For Drupal: Discovery & Requirements Analysis, Environment Setup, Drupal Installation & Base Configuration, Configuration Management Setup, Roles & Permissions, Media Library Setup, Deployment Pipeline, QA/Bug Fixes & Stabilisation (10-15% of total). For WordPress: Discovery & Requirements Analysis, Environment Setup, WordPress Installation & Base Configuration, Plugin Management & Configuration, Roles & Capabilities Setup, Media Library Configuration, Deployment Pipeline, QA/Bug Fixes & Stabilisation (10-15% of total). Flag missing tasks as validation errors.

RULE 17: ALWAYS classify integrations by tier (T1 Simple 8-16h, T2 Standard 16-32h, T3 Complex 32-60h) and state the tier in the Description column. Unknown API docs = bump up one tier.

RULE 18: Assumptions MUST include impact-if-wrong: what changes in the estimate if the assumption doesn't hold. Format: "What: [assumption ref TOR/Q&A]. Impact if wrong: [effort/scope change]."

RULE 19: ALWAYS write a state file alongside estimates with <!-- OPTIMISTIC-ESTIMATE-STATE --> marker. State files enable iterative refinement when clarification answers arrive.

RULE 20 (STRUCTURED ASSUMPTIONS SIDECAR): At the end of every estimate artefact (Phase 1A and Phase 3), you MUST emit a structured ASSUMPTIONS-JSON sidecar immediately after the estimate tables:

<!-- ASSUMPTIONS-JSON
{
  "assumptions": [
    {
      "text": "Full assumption statement — what is included, what is excluded (1-3 sentences).",
      "torReference": "TOR Section X.Y or Q&A Question N",
      "impactIfWrong": "Concise effort/scope impact: +X hrs or CR required for [scope change].",
      "category": "SCOPE | REGULATORY | INTEGRATION | MIGRATION | OPERATIONAL | PERFORMANCE",
      "tab": "BACKEND | FRONTEND | FIXED_COST | AI | GENERAL",
      "regulationContext": "Cite regulation and specific clause if category=REGULATORY, else omit.",
      "crBoundaryEffect": "Plain-English CR trigger: If client requires Y instead, raise CR for +X-Y hrs.",
      "clauseRef": "normalised TOR clause ref if traceable, else omit"
    }
  ]
}
-->

Every assumption in the Assumption Register table MUST have a corresponding entry in this sidecar. category=REGULATORY is required for any assumption that cites a compliance obligation. crBoundaryEffect must be actionable — a PM must be able to raise a change request using this text alone.`;
}
