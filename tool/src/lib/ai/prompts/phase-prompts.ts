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

export interface Phase1AEstimatePromptParams {
  techStack?: string;
  engagementType?: string;
  techStackCustom?: string;
  projectDescription?: string;
  ecosystemNotes?: string;
  benchmarksMarkdown?: string;
}

// Back-compat overloads: accept either a params object or the old positional args.
export function getPhase1AEstimatePrompt(params?: Phase1AEstimatePromptParams): string;
export function getPhase1AEstimatePrompt(techStack?: string, engagementType?: string): string;
export function getPhase1AEstimatePrompt(
  arg1?: string | Phase1AEstimatePromptParams,
  arg2?: string
): string {
  const params: Phase1AEstimatePromptParams =
    typeof arg1 === "string" || arg1 === undefined
      ? { techStack: arg1 as string | undefined, engagementType: arg2 }
      : arg1;
  const {
    techStack,
    engagementType,
    techStackCustom,
    projectDescription,
    ecosystemNotes,
    benchmarksMarkdown,
  } = params;

  const isOther = techStack === "OTHER" || Boolean(techStackCustom);
  const isWordPress = !isOther && techStack?.startsWith("WORDPRESS");
  const isDrupal = !isOther && (!techStack || techStack?.startsWith("DRUPAL") || techStack === "NEXTJS" || techStack === "REACT");
  const platformName = isOther
    ? (techStackCustom?.split(/[.,;\n]/)[0].trim() || "the specified stack")
    : isWordPress
      ? "WordPress"
      : "Drupal";
  const nativeSolutions = isWordPress
    ? "WordPress plugins (cite wordpress.org links), core Gutenberg blocks/patterns, and theme.json capabilities"
    : isDrupal
      ? "contrib modules (cite drupal.org links), core features, and platform-native solutions"
      : "platform-native / ecosystem packages (cite the relevant authoritative registry or docs — npm, Packagist, PyPI, GitHub org docs, vendor marketplace, etc.)";
  const customDev = isWordPress
    ? "custom plugin development"
    : isDrupal
      ? "custom module development"
      : "bespoke custom development";
  const isDiscovery = engagementType === "DISCOVERY";
  const isMigration = engagementType === "MIGRATION" || engagementType === "REDESIGN";

  const legacyDiscoveryBlock = (isMigration && isOther)
    ? `\n## Mandatory Legacy System Discovery Line Item\n\nBecause this is a ${engagementType} engagement on a custom/unfamiliar stack with no original vendor available to assist, you MUST include a dedicated **"Legacy System Discovery & Archaeology"** line item as the FIRST row of the Backend Tab. This task covers:\n- Reverse-engineering the existing platform's architecture, data model, and integrations without vendor support\n- Mapping all content types, custom logic, and third-party integrations in the legacy system\n- Identifying hidden scope (undocumented features, customisations, data quality issues)\n- Producing a discovery brief that feeds into the build estimate\n\nUse a base effort of **24–40 hours** (Conf 3–4 depending on platform complexity). Higher range applies when the legacy platform is proprietary, undocumented, or tightly coupled. Include in Assumptions: "No vendor/original developer support available; effort covers independent system archaeology only."\n`
    : "";

  const projectContextBlock = projectDescription?.trim()
    ? `\n## Project Context (User-Provided)\n\nThe user described this engagement as follows — treat this as authoritative intent alongside the TOR, but cite the TOR for any requirement-level claim:\n\n> ${projectDescription.trim().replace(/\n/g, "\n> ")}\n`
    : "";

  const stackDetailBlock = techStackCustom?.trim()
    ? `\n**User-Provided Stack Detail:** ${techStackCustom.trim()}\n`
    : "";

  const ecosystemBlock = ecosystemNotes?.trim()
    ? `\n## Ecosystem Notes (Web-Researched)\n\nThe following ecosystem summary was bootstrapped via web research for the user-provided stack. Use it to ground "native vs custom" recommendations. Cite the sources surfaced in the research step when leaning on these claims.\n\n${ecosystemNotes.trim()}\n`
    : "";

  const benchmarksBlock = benchmarksMarkdown?.trim()
    ? `\n## Reference Benchmarks (Bootstrapped for This Stack)\n\nUse the following bootstrapped benchmark table as the primary BenchmarkRef source for this engagement. Every line item must cite a BenchmarkKey from this table (or "N/A" with explanation).\n\n${benchmarksMarkdown.trim()}\n`
    : "";

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

${isDiscovery ? "Estimate the effort required to conduct discovery for this engagement." : isOther ? "Customer Q&A responses are not available. Generate assumption-heavy estimates. **This engagement uses a custom/unfamiliar tech stack — do NOT default to optimistic low-end figures. Use the mid-to-high end of all researched ranges and apply explicit estimation buffers to account for stack-specific unknowns.**" : "Customer Q&A responses are not available. Generate assumption-heavy estimates optimised for competitive positioning."}

**Platform: ${platformName}**${isDiscovery ? "" : ` — Prefer ${nativeSolutions} over ${customDev} where possible.`}${stackDetailBlock}${projectContextBlock}${ecosystemBlock}${benchmarksBlock}${legacyDiscoveryBlock}${discoveryPreamble}

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

1. Convert every Phase 1 clarifying question into an assumption. ${isOther ? "**Do NOT select the lowest-effort option for custom/unfamiliar stacks — choose the mid-range option to account for ecosystem uncertainty.**" : "Select the lowest-effort option for each."}
2. Prefer ${nativeSolutions} over ${customDev}.
3. Frame every assumption as a change-request boundary.
${isOther ? `
**Custom Stack Estimation Stance (MANDATORY):**
- Default Conf for all line items should be **4** (not 5 or 6), which auto-applies a 50% High Hrs buffer. Only use Conf 5–6 for tasks that are truly stack-agnostic and well-understood (e.g., environment setup, DNS/SSL, project management).
- Explicitly note estimation uncertainty in the Assumptions column for any task where the stack's ecosystem approach is unclear.
- Do not compress hours to win on price — this stack has no established QED42 benchmark baseline.
` : ""}

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
      "orphanJustification": null,
      "benchmarkLowHrs": 24,
      "benchmarkHighHrs": 48,
      "deviationReason": null
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
      "orphanJustification": "Standard cross-cutting DevOps item not tied to a specific TOR clause.",
      "benchmarkLowHrs": null,
      "benchmarkHighHrs": null,
      "deviationReason": null
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
- \`benchmarkLowHrs\` / \`benchmarkHighHrs\`: copy the LowHrs/HighHrs from the matched
  benchmark row. Both \`null\` when benchmarkRef is \`null\`.
- \`deviationReason\`: populate when chosen \`hours\` falls outside benchmarkLowHrs-benchmarkHighHrs
  range (e.g. "30+ field content type exceeds standard benchmark max of 20h"). Otherwise \`null\`.
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

Read ALL files in responses_qna/ using Glob then Read — there may be multiple documents uploaded across separate sessions (addendums). Treat ALL of them collectively as the complete customer response.

Cross-reference the responses against:
- initial_questions/questions.md — the original clarifying questions
- claude-artefacts/tor-assessment.md — the requirement clarity assessments from Phase 1

## Steps

1. **Inventory all response documents**: list every file found in responses_qna/ at the top of your output.

2. **Map responses to requirements**: for each TOR requirement that was questioned (from questions.md), identify what the customer said. If multiple addendum documents address the same question, merge the answers.

3. **Update clarity ratings**: for each requirement addressed by the responses, determine the new clarity rating:
   - CLEAR — fully answered, no ambiguity remains
   - NEEDS_CLARIFICATION — partially answered, a specific follow-up is still needed
   - AMBIGUOUS — response was vague or contradictory
   - MISSING_DETAIL — question was not answered at all in any response document

4. **Identify new scope items** revealed by responses that were not in the original TOR.

5. **List remaining open questions** that the customer has not yet addressed.

6. Write a unified response analysis to claude-artefacts/response-analysis.md covering all uploaded documents.

## MACHINE-READABLE SIDECAR (MANDATORY)

At the VERY END of claude-artefacts/response-analysis.md, append an HTML comment sidecar so the platform can update requirement clarity ratings in the database.

\`\`\`
<!-- PHASE2-REQUIREMENTS-UPDATE-JSON
{
  "updates": [
    {
      "clauseRef": "3.2.1",
      "clarityRating": "CLEAR",
      "responseNotes": "Customer confirmed X in document Y."
    }
  ]
}
-->
\`\`\`

Sidecar rules:
- Emit ONE entry per TOR requirement that was addressed (even partially) by any response document.
- \`clauseRef\`: MUST match a clauseRef from Phase 1's requirements assessment exactly.
- \`clarityRating\`: the UPDATED rating after all responses — one of \`CLEAR | NEEDS_CLARIFICATION | AMBIGUOUS | MISSING_DETAIL\`.
- \`responseNotes\`: 1–2 sentence summary of what the customer said. Be specific; cite the document name if there are multiple.
- Only include requirements with relevant customer input. Omit requirements not addressed in any response.
- JSON must be strictly valid. HTML comment markers must appear verbatim.`;
}

export function getPhase3Prompt(techStack?: string, engagementType?: string): string {
  const isDiscovery = engagementType === "DISCOVERY";

  return `Conduct Phase 3: Informed Estimates.

You have the customer's Q&A responses available. Use them to generate a fully-informed solution architecture and estimate — not an optimistic one. Every scope decision is now grounded in actual customer answers, not assumptions.

> ⚠️ IMPORTANT: Do NOT read any files from the \`estimates/\` directory. Phase 1A may have written
> an optimistic estimate there, but it is NOT an input to this phase. You are creating new
> informed estimates from scratch. Reading Phase 1A estimates would anchor your thinking to
> optimistic assumptions and defeat the purpose of this phase.

## Mandatory Inputs (read in order)

1. Read \`claude-artefacts/tor-assessment.md\` — requirements and clarity ratings from Phase 1.
2. Read \`initial_questions/questions.md\` if it exists — the original clarifying questions to understand what was ambiguous.
3. Read \`claude-artefacts/response-analysis.md\` if it exists — Phase 2's unified analysis of all response documents. If this file does not exist, read the raw Q&A files in step 4 directly.
4. Read ALL files in \`responses_qna/\` — for direct reference to customer statements. These are authoritative; cite them by filename and section when scoping decisions.
5. Read \`claude-artefacts/solution-architecture.md\` — the v0 architecture from Phase 1 to update.

Do NOT read from \`estimates/\`, \`research/\`, or any other directories not listed above.

---

## Step 1 — Revise Solution Architecture to v1

Update \`claude-artefacts/solution-architecture.md\` in-place to v1:

- Remove the "v0 draft" header; mark as \`**Version: v1 — informed by Phase 2 Q&A responses**\`.
- For each open architecture question from v0, record the customer's answer (cite the response doc).
- Update proposed stack choices, integration map, and component list based on responses.
- Close resolved questions; retain any still-unresolved items as explicit "Remaining Open Questions".

---

## Step 2 — Generate Informed Estimates

${isDiscovery ? `This is a DISCOVERY engagement. Estimate the effort to CONDUCT discovery activities only (workshops, architecture review, PoCs, documentation). Do NOT estimate build/implementation effort.` : `Generate a complete estimate for the build scope confirmed by the customer's responses.`}

### Guiding Principles (different from Phase 1A)

- Use **actual customer answers** to determine scope — not optimistic assumptions.
- Where responses CLEAR ambiguities, apply specific confirmed scope. Where ambiguities remain, document them as residual assumptions.
- Confidence (Conf) values should generally be higher than Phase 1A (more info = more certainty).
- Still-unresolved items may warrant Conf 3–4; flag those explicitly.

### Residual Assumptions

For every assumption (confirmed scope that is still bounded, or remaining ambiguity), write it using the same structured format as Phase 1A:
- **What is included**: Specific scope covered by this estimate line (1-2 sentences with concrete boundary, e.g. "Includes up to 3 content types with up to 15 fields each")
- **What is excluded**: What would require a change request (explicit exclusion list)
- **TOR reference**: The specific TOR clause or Q&A response this assumption relates to
- **CR boundary effect**: Plain-English trigger for a change request ("If the client requires X instead, raise a CR for +Y hrs")
- **Category**: SCOPE / REGULATORY / INTEGRATION / MIGRATION / OPERATIONAL / PERFORMANCE
- If the customer operates in a regulated industry or the TOR cites compliance obligations, every regulated-domain line item must have a corresponding REGULATORY assumption citing the specific clause.

### Estimate Tabs

Produce four tabs. Write the full estimate to \`estimates/informed-estimate.md\`.

**Backend Tab** — CMS/server-side development tasks (PM + QA auto-calculated):
- One row per feature/module, component-level granularity
- Include all always-required Backend tasks: Discovery & Requirements Analysis, Environment Setup, Base Configuration, CMI Setup, Roles & Permissions, Media Library, Deployment Pipeline, QA/Stabilisation
- Classify all integrations by tier: T1 (8–16h), T2 (16–32h), T3 (32–60h)
- Quote the TOR clause or Q&A document for every scope decision

**Frontend Tab** — Component-level UI estimates (PM + QA auto-calculated):
- One row per component (Header, Footer, Hero, Card, Navigation, etc.)
- Include Design System line item
- Add visual reference links to comparable components when designs unavailable
- Exclusions column: list what is NOT included

**Fixed Cost Items Tab** — Operational tasks (NO QA/PM overhead):
- DevOps, documentation, training, onboarding, UAT support, warranty/hypercare
- Never place development tasks here

**AI Tab** — AI-powered features only (if applicable)

### Confidence & Buffer Rules

- Conf 6 = 0%, 5 = +25%, 4 = +50%, 3 = +50%, 2 = +75%, 1 = +100%
- Low Hrs = base Hours; High Hrs = Hours × (1 + buffer %)
- Most items should be Conf 4–6 given Q&A responses are available
- Generate Risk Register for all items with Conf ≤ 4

### State File

Write \`estimates/informed-estimate-state.md\` alongside the estimate. Use the following structure:

\`\`\`
<!-- INFORMED-ESTIMATE-STATE -->
# Informed Estimate State

## Remaining Open Questions
| Question | TOR/Q&A Ref | Impact if Unresolved |
|----------|-------------|----------------------|
| ...      | ...         | ...                  |

## Scope Boundaries Confirmed by Customer
| Item | Customer Statement | TOR Ref |
|------|-------------------|---------|
| ...  | ...               | ...     |
\`\`\``

---

## Step 3 — Machine-Readable Sidecars (MANDATORY)

At the VERY END of \`estimates/informed-estimate.md\`, append two HTML comment blocks in order: first the line-item sidecar, then the assumptions sidecar.

### Sidecar 1: ESTIMATE-LINEITEMS-JSON

\`\`\`
<!-- ESTIMATE-LINEITEMS-JSON
{
  "lineItems": [
    {
      "tab": "BACKEND",
      "task": "Task name",
      "description": "Covers TOR §X.Y.",
      "hours": 24,
      "conf": 5,
      "lowHrs": 24,
      "highHrs": 30,
      "benchmarkRef": "backend/content-type-complex",
      "integrationTier": null,
      "torClauseRefs": ["X.Y"],
      "orphanJustification": null,
      "benchmarkLowHrs": 8,
      "benchmarkHighHrs": 20,
      "deviationReason": null
    }
  ]
}
-->
\`\`\`

Sidecar rules:
- One row per line item across ALL tabs.
- \`torClauseRefs\`: TOR clauseRef strings (same values Phase 1 emitted). Required.
- \`integrationTier\`: \`"T1" | "T2" | "T3" | null\` — required non-null for integration items.
- \`orphanJustification\`: required non-empty string when \`torClauseRefs\` is empty, else \`null\`.
- \`benchmarkLowHrs\` / \`benchmarkHighHrs\`: copy the LowHrs/HighHrs from the matched benchmark row. Set both to \`null\` if benchmarkRef is "N/A".
- \`deviationReason\`: populate if chosen hours fall outside benchmarkLowHrs–benchmarkHighHrs, else \`null\`.
- JSON must be strictly valid.

### Sidecar 2: ASSUMPTIONS-JSON

Follow CARL RULE 20 exactly. Emit every assumption from the Assumption Register as a structured entry. category=REGULATORY is mandatory for compliance-related assumptions. crBoundaryEffect must be actionable standalone text a PM can use to raise a CR.`;
}

/**
 * Phase 3R review prompt — validates the estimates generated by Phase 3.
 * Used by the 3R combined config (review + gap analysis).
 */
export function getPhase3ReviewPrompt(): string {
  return `Conduct Phase 3R Part A: Estimate Review & Validation.

The estimates generated by Phase 3 (Informed Estimates) are in \`estimates/informed-estimate.md\`.
Review them against TOR requirements and customer responses.

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
- Are residual assumptions consistent with what the customer's Q&A confirmed?
- Do assumptions reference TOR sections or Q&A responses (not internal artefacts)?
- Is the Conf buffer formula applied correctly for all Low/High Hrs?
- Does the ASSUMPTIONS-JSON sidecar exist and cover every Assumption Register entry?
- Does each assumption include a crBoundaryEffect a PM can use to raise a CR?

**Pass 4: Regulatory Coverage**
- Scan the TOR and response analysis for compliance obligations: HIPAA, SOC 2, PCI-DSS, GDPR, WCAG-A/AA/AAA, sector-specific regulations, or any explicit compliance statement by the customer.
- For each identified regulation, confirm that at least one Assumption with category=REGULATORY exists that cites it.
- Flag any regulated-domain line item (auth, data storage, reporting, accessibility) that lacks a REGULATORY assumption as a COMPLIANCE GAP.
- Produce a "Regulatory Coverage" table: | Regulation | Applicable | REGULATORY Assumptions | Gap? |

Write review notes to \`claude-artefacts/estimate-review.md\`.`;
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

export function getMigrationAccessChecklistPrompt(params: {
  engagementType?: string;
  legacyPlatform?: string;
  legacyPlatformUrl?: string;
  techStackCustom?: string;
}): string {
  const { engagementType, legacyPlatform, legacyPlatformUrl, techStackCustom } = params;
  const isRedesign = engagementType === "REDESIGN";
  const platformLine = legacyPlatform?.trim()
    ? `The customer's current platform is: **${legacyPlatform.trim()}**.`
    : `The customer's current platform is not explicitly stated in the TOR — infer a best-guess from TOR references and the site at ${legacyPlatformUrl?.trim() || "the legacy URL (if any)"}, and call out ambiguity in the checklist's Notes column.`;
  const urlLine = legacyPlatformUrl?.trim() ? `Current site URL: ${legacyPlatformUrl.trim()}.` : "";
  const stackLine = techStackCustom?.trim() ? `Target stack context: ${techStackCustom.trim()}.` : "";

  const scopeClause = isRedesign
    ? `This is a **REDESIGN** engagement. Scope the checklist narrowly to access items needed to audit the current site, preserve SEO/analytics continuity, and cut over without breaking inbound traffic. Do NOT include full database/backend exports unless the redesign requires migrating content.`
    : `This is a **MIGRATION** engagement. Scope the checklist fully — from source-system credentials through content exports, integration credentials, code/infra access, and stakeholder contacts.`;

  return `Generate the Legacy Platform Access Checklist.

${scopeClause}

${platformLine} ${urlLine} ${stackLine}

## Working Assumption: Legacy Vendor Is Unavailable

**IMPORTANT — write the entire checklist assuming the original vendor/agency/developer of the legacy website is NO LONGER REACHABLE** (they may have wound down, lost the relationship with the customer, or simply not responded). That means:
- Every item must be phrased so that the customer's own in-house staff (often non-technical marketing, ops, or admin teams) can locate and hand it over without the old vendor's help.
- Do NOT tell the customer to "ask your current vendor for X". Instead, tell them where to look inside their own accounts (hosting control panel, domain registrar, email inbox archive, invoices/SOWs, HR records of past employees, shared drives, password managers, etc.).
- Where only the vendor would reasonably have a credential, mark the item Notes with: "If this is not locatable in your accounts, we will treat it as a data-recovery/reverse-engineering risk — see Notes." and explain in plain words what we would do instead (e.g. "we will rebuild this from scratch", "we will crawl the public site", "we will work with whatever export your hosting provider can give us directly").

## Audience: Non-Technical Customer

The reader may be a marketing lead, operations manager, or business owner — NOT a developer. Rewrite every row so a reader with no engineering background can understand what is being asked and how to provide it. Rules:
- Spell out acronyms on first use (e.g. "DNS (Domain Name System — the setting that points your domain at a server)", "CDN (Content Delivery Network — e.g. Cloudflare, Akamai)").
- Prefer human language over technical jargon ("a full copy of your website's database" rather than "SQL dump"; mention the technical term in parentheses afterwards).
- Give a concrete example of where to look ("usually inside your hosting provider's control panel under 'Databases' or 'Backups'") instead of assuming the reader knows.
- In the **Why Needed** column, explain the consequence in business terms ("Without this, content from the last 5 years may not carry over and editors will have to re-enter it by hand").
- Be VERBOSE. One-line items are too terse. Aim for 2–4 sentences per Item and 2–3 sentences per Why Needed. This document is meant to be a standalone brief, not a quick-reference cheat sheet.

## Required Structure

Use these EXACT markdown headings (parsers may depend on them later):

\`\`\`
## 1. Legacy Website — Admin & Hosting Access
## 2. Legacy Website — Content, Media & Data Exports
## 3. Third-Party Integrations & Vendor Accounts
## 4. Credentials, Secrets & API Keys
## 5. Analytics, SEO & Marketing
## 6. Code, Source Files & Infrastructure
## 7. Documentation, Contracts & Knowledge Artefacts
## 8. Stakeholder & Support Access
\`\`\`

Under each heading, a markdown table with these exact columns:

| Item | Why Needed | Where to Find It | Format / Access Type | Priority | Customer Owner | Notes |

- **Item**: Full, self-contained description written for a non-technical reader. 2–4 sentences including plain-language meaning + technical term in parentheses.
- **Why Needed**: 2–3 sentences explaining, in business terms, what breaks or what risk we carry if this item is NOT provided. Avoid jargon.
- **Where to Find It**: Plain-language hints on the customer's side — "Check your hosting provider's dashboard", "Look in old contracts with your previous agency", "Ask your finance team who paid the hosting invoices", "Look for login emails in [key stakeholder]'s inbox from [year] onwards". This column is critical when the legacy vendor is unreachable.
- **Format / Access Type**: Concrete format or access mechanism (full database export, admin login, read-only dashboard access, shared drive link, etc.), phrased in customer-facing language.
- **Priority**: \`P0\` (blocking kickoff), \`P1\` (blocking a mid-project milestone), \`P2\` (nice-to-have / enables optimisation). Be realistic — not every item is P0.
- **Customer Owner**: Role on the customer's side expected to provide this (e.g. "Marketing Lead", "IT / Tech Contact", "Finance / Accounts", "Admin / Operations"). Use roles, not specific people.
- **Notes**: Alternatives if the primary path is unavailable. State explicitly what QED42 will do if the item cannot be produced (rebuild from scratch, crawl public site, reconstruct from backups, treat as change request, etc.) — this is your "vendor-gone" fallback statement.

## Content Expectations Per Section

Each section must have **at least 3 rows**; sections 1–4 should typically have 5–8 rows.

**Section 1 — Legacy Website — Admin & Hosting Access** must cover: CMS/admin login for the legacy site; hosting provider login (where the site runs); DNS / domain registrar login (who owns the domain and points traffic); SSL certificate provider/login; email / mailbox associated with admin accounts; any VPN/firewall or security-layer access in front of the site.

**Section 2 — Legacy Website — Content, Media & Data Exports** must cover: full database backup in whatever format the legacy hosting can produce; all uploaded files (images, PDFs, videos — "media library"); list of URLs and their redirects; list of content types/templates and how they map; user account list with roles (so we don't lose editors/authors); historical content (posts, pages, products, etc.) including anything archived/unpublished.

**Section 3 — Third-Party Integrations & Vendor Accounts** must cover, at minimum, an exhaustive list of every external service the legacy site talks to or the marketing team uses around it. Prompt the customer to walk through: email marketing (Mailchimp, HubSpot, Marketo), CRM, payment gateways, live-chat widgets, analytics (GA4, Adobe Analytics, Hotjar), tag managers, search providers (Algolia, Elastic), social login, feature flags, A/B testing, customer support (Zendesk, Intercom), consent/cookie banners, newsletter signup, form-handling services, webhooks, any external APIs the site posts/pulls data from. For each: login access, the account's billing owner, and whether the subscription is active. Call out that any integration missed here will show up as a scope surprise later.

**Section 4 — Credentials, Secrets & API Keys** must cover: every secret/API key the legacy site uses (payment, email, map, analytics, AI, etc.); the place they are stored today (environment files, password manager, hosting panel env vars); and how the customer can rotate them. If the customer doesn't know where the keys live, explicitly state "QED42 will rotate/replace all integration keys during migration" as the fallback.

Sections 5–8 follow the same pattern — verbose, non-technical, vendor-gone-safe.

## Output File

Write output to \`claude-artefacts/legacy-access-checklist.md\` following \`templates/legacy-access-checklist-template.md\`. Prepend a short Introduction paragraph explaining what this document is and how the customer should return it (track provisioned items, owner, and estimated availability date).

## Cross-Linking

At the end of the document, add a one-line footer:
> This checklist is a companion to the Technical Proposal. Items marked P0 are kickoff blockers — please prioritise provisioning for these.

## Non-Negotiables

- Every row MUST have a non-empty value in all six columns (use "—" only in Notes when truly not applicable).
- Priorities must be realistic — not every item can be P0.
- Do NOT invent credentials that the legacy platform would not have (e.g. don't ask for "Kubernetes kubeconfig" if the stated platform is a single-VM WordPress install).
- Do NOT leak internal QED42 assignments into the Customer Owner column.
`;
}
