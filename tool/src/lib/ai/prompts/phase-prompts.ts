export function getPhase0Prompt(engagementType?: string): string {
  const isSiteAuditRelevant =
    engagementType === "MIGRATION" || engagementType === "REDESIGN";

  const siteAuditSection = isSiteAuditRelevant
    ? `3. If a site URL is available (from TOR or discovered via research), perform a full site audit:
   - Technology stack (CMS, frameworks, server, hosting, CDN) from HTTP headers and HTML source
   - Site structure and information architecture
   - Page volume estimate via sitemap.xml
   - Performance baseline (Core Web Vitals)
   - SEO health (meta tags, structured data, sitemaps, robots.txt)
   - Third-party integrations inventory
   - Security headers and mobile experience`
    : `3. This is a ${engagementType?.replace(/_/g, " ").toLowerCase() ?? "new"} engagement - skip site audit unless the TOR explicitly provides a URL for an existing site that must be referenced or migrated from. Focus research effort on customer background, industry context, and TOR requirement analysis instead.`;

  return `Conduct Phase 0: Customer & Site Research.

Read the TOR document(s) in tor/ and perform the following:

1. Extract the customer name, site URL (if any), and project context from the TOR.
2. Research the organisation: industry, digital presence, strategic initiatives, regulatory environment.
${siteAuditSection}
4. Align research findings with TOR requirements to identify hidden scope and risks.
5. Write output to research/customer-research.md following the customer-research-template.md structure.
6. Export all tabular data as CSV files to research/csv/ (10 files: tech-stack, site-structure, content-types, content-volume, performance-baseline, seo-health, third-party-integrations, hidden-scope, risk-register, estimation-adjustments).`;
}

export function getPhase1Prompt(): string {
  return `Conduct Phase 1: TOR Analysis & Clarifying Questions.

Read the TOR document(s) in tor/ and any Phase 0 research in research/.

1. Parse and categorise all requirements by domain:
   content architecture | integrations | migrations | frontend/theming | DevOps/hosting | SEO | accessibility | performance | security

2. For each requirement, assess clarity:
   Clear | Needs Clarification | Ambiguous | Missing Detail

3. Identify ambiguities, missing details, implicit assumptions, and technical risks.

4. Cross-reference any research-identified hidden scope items against TOR requirements.

5. Generate structured clarifying questions grouped by requirement area.
   - Each question must be specific and reference the exact TOR clause.
   - Propose concrete options (A/B/C) where possible.
   - Never ask generic "can you elaborate?" questions.

6. Classify the overall engagement scope:
   - If the TOR primarily asks for a discovery/assessment/audit/feasibility study with no build deliverables expected, flag as **"DISCOVERY SCOPE DETECTED"** in the assessment summary and note which discovery activities are implied (workshops, architecture review, PoCs, etc.).
   - If the TOR asks for implementation/build/development deliverables, classify as **build scope**.
   This classification helps downstream phases generate appropriate estimates.

7. Write outputs:
   - claude-artefacts/tor-assessment.md (following tor-assessment-template.md)
   - initial_questions/questions.md (following questions-template.md)
   - **claude-artefacts/solution-architecture.md (MANDATORY v0 draft — see below)**

## Mandatory v0 Solution Architecture (BOTH paths)

You MUST emit a v0 \`claude-artefacts/solution-architecture.md\` at Phase 1, regardless of whether customer Q&A responses are available. This is the pre-approved technical anchor that Phase 1A and Phase 3 revise, and that Phase 5 depends on.

The v0 should be high-level only (Phase 1A/3 fill in the detail):

- **Header**: mark explicitly \`**Version: v0 — will be revised in Phase 1A / Phase 3**\` on the first line.
- **Proposed Stack Choices**: list platform, frontend framework, hosting, CDN, CI/CD, search, and any other stack layers implied by the TOR technology requirements. One line of rationale per choice.
- **Major Components**: enumerate the system components (CMS, front-end app, API layer, search index, media store, auth provider, etc.) the estimate will later break down.
- **Integration Map**: one row per integration surfaced in the TOR — external system, direction, proposed approach (REST/GraphQL/webhook/SDK), and a tentative tier guess (T1/T2/T3 or "TBD").
- **Open Architecture Questions**: the unresolved architecture decisions that Phase 1A/3 will close.

Every claim in this document MUST cite a TOR section/clause (e.g. "Per TOR §3.2.1 …"). Unsupported claims are not permitted in v0. Keep the document concise — target roughly 1-2 pages. Do not invent detail the TOR does not support; mark gaps as open questions instead.

**CRITICAL: Use these EXACT markdown headings in tor-assessment.md. Parsers depend on this format:**

\`\`\`
## Requirements Assessment
\`\`\`

The Requirements Assessment section MUST be a markdown table with columns:
| Requirement ID | Domain | Description | Clarity Rating | Notes |

Where Clarity Rating is one of: Clear, Needs Clarification, Ambiguous, Missing Detail.

Also include a summary section:
\`\`\`
## Clarity Assessment Summary
\`\`\`

As a table: | Clarity Rating | Count | Percentage |

## MACHINE-READABLE SIDECAR (MANDATORY)

At the VERY END of \`claude-artefacts/tor-assessment.md\` (after all markdown sections),
append a raw HTML comment containing a JSON sidecar so downstream writers can
ingest the requirements into the database. This must be the last content in the
file. Do NOT wrap it in a markdown code fence.

\`\`\`
<!-- PHASE1-REQUIREMENTS-JSON
{
  "requirements": [
    {
      "clauseRef": "3.2.1",
      "title": "Short requirement title",
      "description": "Paraphrase of the TOR clause in 1-2 sentences.",
      "domain": "integration",
      "clarityRating": "CLEAR"
    }
  ]
}
-->
\`\`\`

Sidecar rules:
- Emit exactly ONE row per distinct TOR requirement. Row count should equal the
  number of rows in the Requirements Assessment table.
- \`clauseRef\`: the TOR section/bullet reference as it appears in the TOR (e.g.
  "3.2.1", "Section 4.1", "Annexure B-2"). Use the same value the assessment
  table uses in the Requirement ID column.
- \`domain\`: MUST be one of exactly these lowercase tokens —
  \`content_arch | integration | migration | frontend | devops | seo | a11y | perf | security | other\`.
- \`clarityRating\`: MUST be one of exactly —
  \`CLEAR | NEEDS_CLARIFICATION | AMBIGUOUS | MISSING_DETAIL\` (match the assessment).
- The JSON must be strictly valid (no trailing commas, no comments inside the JSON).
- The HTML comment opener \`<!-- PHASE1-REQUIREMENTS-JSON\` and closing \`-->\`
  must appear verbatim; writers regex-extract the body between them.`;
}

export function getPhase1AEstimatePrompt(techStack?: string, engagementType?: string): string {
  const isWordPress = techStack?.startsWith("WORDPRESS");
  const platformName = isWordPress ? "WordPress" : "Drupal";
  const nativeSolutions = isWordPress
    ? "WordPress plugins (cite wordpress.org links), core Gutenberg blocks/patterns, and theme.json capabilities"
    : "contrib modules (cite drupal.org links), core features, and platform-native solutions";
  const customDev = isWordPress ? "custom plugin development" : "custom module development";
  const isDiscovery = engagementType === "DISCOVERY";

  const discoveryPreamble = isDiscovery ? `

## DISCOVERY ENGAGEMENT — Estimate Discovery Activities ONLY

This is a **DISCOVERY-ONLY** engagement. Do NOT estimate build/implementation effort.
Instead, estimate the effort required to CONDUCT a comprehensive discovery phase for the client.

### Discovery Activity Categories for Tabs

**Backend Tab — Technical Discovery:**
- Requirements workshops (stakeholder sessions, requirement deep-dives, user story mapping)
- Technical architecture review (current state assessment, target architecture design, technology evaluation)
- Integration landscape mapping (API audit, data flow analysis, third-party inventory)
- Technology evaluation & PoC development (spike work, feasibility testing, proof-of-concept)
- Content architecture analysis (content modeling, taxonomy design, migration assessment)
- Performance & security audit (if existing system exists)
- Infrastructure & hosting assessment and recommendations

**Frontend Tab — UX/Design Discovery:**
- UX research (user interviews, persona development, journey mapping, analytics review)
- Information architecture (sitemap, navigation design, content hierarchy)
- Wireframing & prototyping (key pages/flows, interactive prototypes)
- Design system audit or initial design direction (mood boards, style tiles)
- Accessibility assessment (WCAG audit of existing properties)
- Competitive/comparable site analysis with documented findings

**Fixed Cost Items Tab — Discovery Overhead:**
- Project setup & kick-off (onboarding, access provisioning, tool setup)
- Stakeholder alignment sessions (recurring syncs, decision-making workshops)
- Discovery documentation & deliverable preparation (assessment report, architecture document, recommendations deck)
- Final presentation & handoff to build team (knowledge transfer, recorded walkthrough)
- Travel (if on-site workshops required — flag as assumption)

**AI Tab (if applicable):**
- AI/ML feasibility assessment (data readiness, model selection, integration complexity)
- AI architecture design (RAG pipeline, LLM integration, vector DB evaluation)

Use these categories for your line items. Every line item should describe a discovery ACTIVITY, not a build deliverable.
` : "";

  return `Conduct Phase 1A: ${isDiscovery ? "Discovery Effort Estimation" : "Optimistic Estimation (No-Response Path)"}.

${isDiscovery ? "Estimate the effort required to conduct discovery for this engagement." : "Customer Q&A responses are not available. Generate assumption-heavy estimates optimised for competitive positioning."}

**Platform: ${platformName}**${isDiscovery ? "" : ` — Prefer ${nativeSolutions} over ${customDev} where possible.`}${discoveryPreamble}

${isDiscovery ? "" : `## Step 1: Solution Architecture Document

BEFORE estimating, write a high-level solution architecture document to claude-artefacts/solution-architecture.md (following solution-architecture-template.md).

This document defines the technical solution that your estimates will be based on. It must:
- Reference specific TOR requirements for every architectural decision
- Justify technology stack choices with rationale and alternatives considered
- Map all integrations to tiers (T1/T2/T3) with specific approach (REST/GraphQL/webhook/SDK)
- Identify all frontend components implied by TOR requirements with complexity rating
- Cover infrastructure, hosting, and DevOps approach
- Document key technical decisions with "Decision / Rationale / Alternative rejected / Estimate impact" format

**Write this document FIRST using the write_file tool. Then proceed to Step 2 (Estimation).**

---

`}## ${isDiscovery ? "" : "Step 2: "}Requirement Traceability

Before estimating, review the TOR Assessment from Phase 1${isDiscovery ? "" : " and the solution architecture document you just wrote"}. Every TOR requirement must map to at least one estimate line item. For each line item, include the TOR requirement ID or section reference in the Description column.

At the end, produce a Traceability Matrix showing:
- Which TOR requirements are covered by which estimate line items
- Any GAPS (TOR requirements with no corresponding estimate)
- Any ORPHANS (estimate items not traceable to a TOR requirement)

## Assumption Strategy

1. Convert every Phase 1 clarifying question into an assumption. Select the lowest-effort option for each.
2. Prefer ${nativeSolutions} over ${customDev}.
3. Frame every assumption as a change-request boundary.

For each assumption, write clearly:
- **What is included**: Specific scope covered by this estimate line (e.g., "Includes a single-level mega menu with up to 8 top-level items and dropdown panels")
- **What is excluded**: What would require a change request (e.g., "Multi-level nested menus, search within navigation, or personalised menu items are excluded")
- **TOR reference**: The specific TOR clause or section this assumption relates to

## Estimate Structure
${isDiscovery ? "" : `
**IMPORTANT: Align estimates with the solution architecture document.**
- The "Proposed Solution" column must reference the relevant section of the solution doc (e.g., "Per Solution Doc §4 — REST API integration with OAuth2")
- Integration tiers must match the solution doc's integration table
- Frontend components must match the solution doc's component breakdown
- Infrastructure/DevOps items must match the solution doc's recommendations
`}
Produce estimates in four tabs matching the QED42 Excel template.

**CRITICAL: Use these EXACT markdown headings for each tab section. Parsers depend on this format:**

\`\`\`
## Backend Tab
## Frontend Tab
## Fixed Cost Items Tab
## AI Tab
\`\`\`

Tab descriptions:
- **Backend Tab**: CMS/server-side development tasks requiring PM+QA overhead
- **Frontend Tab**: Component-level UI estimates (Header, Footer, Hero, Card, etc.) with visual reference links and Exclusions column
- **Fixed Cost Items Tab**: Operational items NOT needing QA/PM (deployment, docs, training, onboarding)
- **AI Tab**: AI-powered features (only if the TOR contains AI-related requirements)

For each line item include these columns in the markdown table:
- Task, Description (include TOR reference), Hours (base), BenchmarkRef, Conf (1-6), Low Hrs, High Hrs, Assumptions (included/excluded scope), Proposed Solution (technical approach), Reference Links
- **BenchmarkRef**: Set to the BenchmarkKey from the Reference Benchmarks lookup table that most closely matches this task. If no benchmark applies, write "N/A" and explain why in Assumptions. If Hours falls outside the matched benchmark's LowHrs–HighHrs range, prepend "BENCHMARK DEVIATION: [reason]" to the Assumptions column.
- Low Hrs = Hours, High Hrs = Hours x (1 + Conf buffer%)
- Conf buffer: 6=0%, 5=+25%, 4=+50%, 3=+50%, 2=+75%, 1=+100%

**Do NOT vary these headings.** Do not add extra words like "Development" or "Estimates" to the heading. The heading must be exactly as shown above.

## Output Summary

At the top of the estimate file, include an Executive Summary with:
- Total estimated effort range (Low to High hours)
- Number of line items per tab
- Key assumptions count
- High-risk items count (Conf <= 4)
- Scope coverage assessment (percentage of TOR requirements mapped)

## Risk Register

Generate a Risk Register for all Conf <= 4 items with: Task, Tab, Conf, Risk/Dependency, Open Question for PM/Client, Recommended Action, Hours at Risk.

## Output Files

Write outputs:
- estimates/optimistic-estimate.md (following optimistic-estimate-template.md)
- estimates/[client]-estimate-state.md (with <!-- OPTIMISTIC-ESTIMATE-STATE --> marker)

## MACHINE-READABLE SIDECAR (MANDATORY)

At the VERY END of \`estimates/optimistic-estimate.md\` (after Risk Register and
all markdown sections), append a raw HTML comment with a JSON sidecar so the
writer step can ingest line items into the database. Do NOT wrap in a code fence.

\`\`\`
<!-- ESTIMATE-LINEITEMS-JSON
{
  "lineItems": [
    {
      "tab": "BACKEND",
      "task": "Content API + syndication service",
      "description": "Covers TOR §3.2.1 multi-site content syndication.",
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
      "task": "Deployment pipeline setup",
      "description": "DevOps onboarding, CI/CD wiring.",
      "hours": 16,
      "conf": 6,
      "lowHrs": 16,
      "highHrs": 16,
      "benchmarkRef": null,
      "integrationTier": null,
      "torClauseRefs": [],
      "orphanJustification": "Standard cross-cutting DevOps item not tied to a specific TOR clause."
    }
  ]
}
-->
\`\`\`

Sidecar rules:
- Emit exactly ONE row per line item in ALL tabs (Backend, Frontend, Fixed Cost, AI).
  Total rows must equal the sum of rows across all tab tables.
- \`tab\`: exactly one of — \`BACKEND | FRONTEND | FIXED_COST | DESIGN | AI\`.
- \`hours\`, \`lowHrs\`, \`highHrs\`: numeric, matching the markdown table.
  \`lowHrs\` = \`hours\`; \`highHrs\` = \`hours × (1 + conf buffer)\` rounded.
- \`conf\`: integer 1-6, matching the markdown.
- \`benchmarkRef\`: the BenchmarkKey used in the Description column, or \`null\`
  when no benchmark applies.
- \`integrationTier\`: \`"T1"\`, \`"T2"\`, \`"T3"\`, or \`null\`. Required (non-null)
  for every integration line item.
- \`torClauseRefs\`: array of TOR clause reference strings (NOT DB IDs) that this
  line item fulfils. Use the SAME clauseRef values Phase 1 emitted in its sidecar
  (e.g. \`"3.2.1"\`). The writer resolves these to \`TorRequirement.id\` by
  normalized-clause lookup.
- \`orphanJustification\`: \`null\` when \`torClauseRefs\` is non-empty. When
  \`torClauseRefs\` is empty the justification MUST be a specific non-empty string
  (e.g. "Cross-cutting DevOps task"). Never leave both empty.
- JSON must be strictly valid (no trailing commas). HTML comment markers must
  appear verbatim.`;
}

export function getPhase1AProposalPrompt(engagementType?: string): string {
  const isDiscovery = engagementType === "DISCOVERY";

  const scopeSection = isDiscovery
    ? `4. Discovery Scope: what discovery activities are included (workshops, architecture review, PoCs, documentation, etc.) — NOT build deliverables`
    : `4. Scope of Work: what is included (summary level, not line-item estimates)`;

  const approachSection = isDiscovery
    ? `2. Our Discovery Approach: discovery methodology, phases (kick-off → research → analysis → synthesis → presentation), team composition`
    : `2. Our Approach: methodology, phases, team structure`;

  const timelineSection = isDiscovery
    ? `6. Timeline: discovery phase schedule (typically 4-8 weeks) with key milestones and deliverable checkpoints`
    : `6. Timeline: indicative milestone schedule`;

  const deliverables = isDiscovery
    ? `\n8. Discovery Deliverables: list all outputs the client will receive (assessment report, architecture document, wireframes, PoC results, recommendations deck, recorded walkthroughs)`
    : "";

  return `Generate a client-facing ${isDiscovery ? "Discovery Proposal" : "Technical Proposal"} Document.

Based on the TOR analysis and ${isDiscovery ? "discovery effort estimates" : "optimistic estimates"} already produced, write a professional ${isDiscovery ? "discovery" : "technical"} proposal suitable for sending to the client.

The proposal should cover:
1. Executive Summary: project understanding, key goals
${approachSection}
3. Technical Architecture: proposed stack, integrations, hosting
${scopeSection}
5. Assumptions & Exclusions: key assumptions that define scope boundaries
${timelineSection}
7. Why Us: relevant experience, capability highlights${deliverables}

Write output to claude-artefacts/technical-proposal.md following the technical-proposal-template.md structure.`;
}

export function getPhase2Prompt(): string {
  return `Conduct Phase 2: Response Integration.

Customer responses are in responses_qna/. Analyse them against the original TOR and clarifying questions.

1. Map each response back to its original question and TOR requirement.
2. Identify still-unresolved ambiguities after responses.
3. Note any new scope items or constraints revealed by responses.
4. Produce an updated requirement clarity assessment.

Write output to claude-artefacts/response-analysis.md.`;
}

export function getPhase3Prompt(): string {
  return `Conduct Phase 3: Estimate Review.

Estimates are in estimates/. Review them against TOR requirements and customer responses.

Perform three validation passes:

**Pass 1: Coverage**
- Is every TOR requirement covered by at least one estimate line item?
- Flag missing requirements as GAPS.
- Flag estimate items with no TOR traceability as ORPHANS.

**Pass 2: Effort Reasonableness**
- Compare effort figures against benchmarks/ reference ranges.
- Flag items that are significantly over or under the benchmark range.
- Check that always-include Backend tasks are present.

**Pass 3: Assumption Consistency**
- Are estimate assumptions consistent with customer Q&A responses?
- Do assumptions reference TOR sections or Q&A responses (not internal artefacts)?
- Is the Conf buffer formula applied correctly for all Low/High Hrs?

Write output to claude-artefacts/estimate-review.md following the estimate-review-template.md structure.

## Revised Estimate Sidecar (MANDATORY when revising line items)

If this review results in a revised estimate written to
\`estimates/revised-estimate.md\` (or updates \`estimates/optimistic-estimate.md\`),
append a raw HTML comment at the VERY END of the estimate file containing the
full revised line-item list as JSON. Do NOT wrap in a code fence.

\`\`\`
<!-- ESTIMATE-LINEITEMS-JSON
{
  "lineItems": [
    {
      "tab": "BACKEND",
      "task": "Content API + syndication service",
      "description": "Covers TOR §3.2.1.",
      "hours": 48,
      "conf": 5,
      "lowHrs": 48,
      "highHrs": 60,
      "benchmarkRef": "backend.api.medium",
      "integrationTier": null,
      "torClauseRefs": ["3.2.1"],
      "orphanJustification": null
    }
  ]
}
-->
\`\`\`

Sidecar rules (same as Phase 1A):
- One row per revised line item across ALL tabs.
- \`tab\`: \`BACKEND | FRONTEND | FIXED_COST | DESIGN | AI\`.
- \`torClauseRefs\`: TOR clauseRef strings (not DB IDs). The writer resolves them
  to \`TorRequirement.id\`. Use the same clauseRefs Phase 1 emitted.
- \`integrationTier\`: \`"T1" | "T2" | "T3" | null\`.
- \`orphanJustification\`: required non-empty string when \`torClauseRefs\` is empty,
  else \`null\`.
- JSON must be strictly valid. HTML comment markers verbatim.

If the review does NOT modify estimate line items, skip the sidecar.`;
}

export function getPhase4Prompt(): string {
  return `Conduct Phase 4: Gap Analysis & Revised Estimates.

Phase 4 is the final safety net before proposal generation. You MUST NOT reshuffle
Phase 3's output. You MUST independently re-derive coverage from the source TOR.

## Mandatory Inputs (read in order, do NOT skip)

1. **Re-read the full TOR document** from the engagement's \`tor/\` folder.
   - Use Glob to enumerate every file in \`tor/\` (PDF, DOCX, MD, TXT).
   - Read each file end-to-end. Do not rely on Phase 1's summary of the TOR.
   - Extract every distinct requirement clause with its identifier (section
     number, bullet reference, or page/line anchor if unnumbered).
2. Read the current estimate: \`estimates/optimistic-estimate.md\` (or the latest
   versioned estimate file in \`estimates/\`).
3. Read \`claude-artefacts/estimate-review.md\` (Phase 3 output) for context — but
   do not treat it as authoritative.
4. Read \`claude-artefacts/response-analysis.md\` if present (Phase 2 output).
5. Read the proposal draft at \`claude-artefacts/technical-proposal.md\` if it
   exists.

## Required Output Structure (gap-analysis.md)

Write to \`claude-artefacts/gap-analysis.md\` following \`templates/gap-analysis-template.md\`.
The document MUST contain, in this order:

### Section 1: Coverage Table

A single markdown table with exactly these columns, one row per distinct TOR clause:

| TOR Clause | Requirement | Estimate Line Items | Coverage Status | Remediation |

- **TOR Clause**: Section/bullet reference as it appears in the source TOR.
- **Requirement**: 1-2 sentence paraphrase of the clause.
- **Estimate Line Items**: Comma-separated list of line item names from the
  estimate that cover this clause. Use \`—\` if none.
- **Coverage Status**: Exactly one of \`COVERED\`, \`PARTIAL\`, \`MISSING\`,
  \`DEFERRED\`.
  - \`COVERED\`: Fully addressed by one or more line items.
  - \`PARTIAL\`: Addressed but scope is narrower than the clause or confidence
    is low.
  - \`MISSING\`: No line item maps to this clause.
  - \`DEFERRED\`: Intentionally out of scope (change-request boundary). Must
    cite the assumption that defers it.
- **Remediation**: REQUIRED for every \`PARTIAL\` or \`MISSING\` row. Must be a
  specific action: "Add line item X to Backend tab (est Y hrs)", "Revise line
  item Z to include W", or "Defer via assumption: <text>". Never leave blank
  on non-COVERED rows. For COVERED rows write \`None\`.

### Section 2: Assumption Carry-Forward Verification

For each assumption in the estimate, confirm:
- It is carried forward verbatim (or tightened, not loosened) into the
  proposal draft at \`claude-artefacts/technical-proposal.md\`.
- It references a TOR section or Q&A response (never an internal artefact).
- Flag any assumption that appears in the estimate but is missing from the
  proposal, and any assumption that appears in the proposal but is not
  grounded in the estimate.

### Section 3: Risk Register Completeness

Enumerate every estimate line item with \`Conf <= 4\`. Confirm each appears
in the Risk Register with an open question and a de-risk action. Flag any
Conf<=4 item missing from the register as a Phase 4 blocker.

### Section 4: JSON Sidecar

At the very end of the markdown file, append a machine-readable sidecar for
future DB ingestion. Use exactly this fenced HTML comment format:

\`\`\`
<!-- PHASE4-COVERAGE-JSON
{
  "torCoverage": {
    "rows": [
      {
        "torClause": "3.2.1",
        "requirement": "Multi-site content syndication",
        "estimateLineItems": ["Syndication service", "Content API"],
        "coverageStatus": "COVERED",
        "remediation": "None"
      }
    ],
    "assumptionCarryForward": {
      "verified": ["<assumption id or text>"],
      "missingFromProposal": [],
      "ungroundedInProposal": []
    },
    "riskRegister": {
      "lowConfLineItems": ["<line item>"],
      "missingFromRegister": []
    }
  }
}
-->
\`\`\`

The JSON must be valid and mirror Section 1 exactly (same row count, same
coverageStatus values). Do not wrap the JSON block in markdown code fences —
it must be a raw HTML comment so downstream writers can regex-extract it.

## Revised Estimates Output

Write \`claude-artefacts/revised-estimates.md\` containing only the deltas:
new line items, revised hour ranges, and updated Conf scores derived from the
remediation column. Do not rewrite the full estimate.

## Non-Negotiables

- Do NOT skip re-reading the TOR, even under context pressure.
- Do NOT emit the coverage table without a remediation action for every
  PARTIAL/MISSING row.
- Do NOT change output file paths or filenames.
- Every row's Estimate Line Items list must use names that actually exist in
  the current estimate file (or be explicitly marked as new additions).`;
}
