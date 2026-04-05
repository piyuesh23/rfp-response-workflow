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

6. Write outputs:
   - claude-artefacts/tor-assessment.md (following tor-assessment-template.md)
   - initial_questions/questions.md (following questions-template.md)`;
}

export function getPhase1AEstimatePrompt(): string {
  return `Conduct Phase 1A: Optimistic Estimation (No-Response Path).

Customer Q&A responses are not available. Generate assumption-heavy estimates optimised for competitive positioning.

## Requirement Traceability

Before estimating, review the TOR Assessment from Phase 1. Every TOR requirement must map to at least one estimate line item. For each line item, include the TOR requirement ID or section reference in the Description column.

At the end, produce a Traceability Matrix showing:
- Which TOR requirements are covered by which estimate line items
- Any GAPS (TOR requirements with no corresponding estimate)
- Any ORPHANS (estimate items not traceable to a TOR requirement)

## Assumption Strategy

1. Convert every Phase 1 clarifying question into an assumption. Select the lowest-effort option for each.
2. Prefer platform-native/contrib solutions over custom development.
3. Frame every assumption as a change-request boundary.

For each assumption, write clearly:
- **What is included**: Specific scope covered by this estimate line (e.g., "Includes a single-level mega menu with up to 8 top-level items and dropdown panels")
- **What is excluded**: What would require a change request (e.g., "Multi-level nested menus, search within navigation, or personalised menu items are excluded")
- **TOR reference**: The specific TOR clause or section this assumption relates to

## Estimate Structure

Produce estimates in four tabs matching the QED42 Excel template:
- **Backend**: CMS/server-side development tasks requiring PM+QA overhead
- **Frontend**: Component-level UI estimates (Header, Footer, Hero, Card, etc.) with visual reference links and Exclusions column
- **Fixed Cost Items**: Operational items NOT needing QA/PM (deployment, docs, training, onboarding)
- **AI**: AI-powered features (only if the TOR contains AI-related requirements)

For each line item include these columns in the markdown table:
- Task, Description (include TOR reference), Hours (base), Conf (1-6), Low Hrs, High Hrs, Assumptions (included/excluded scope), Proposed Solution (technical approach), Reference Links
- Low Hrs = Hours, High Hrs = Hours x (1 + Conf buffer%)
- Conf buffer: 6=0%, 5=+25%, 4=+50%, 3=+50%, 2=+75%, 1=+100%

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
- estimates/[client]-estimate-state.md (with <!-- OPTIMISTIC-ESTIMATE-STATE --> marker)`;
}

export function getPhase1AProposalPrompt(): string {
  return `Generate a client-facing Technical Proposal Document.

Based on the TOR analysis and optimistic estimates already produced, write a professional technical proposal suitable for sending to the client.

The proposal should cover:
1. Executive Summary: project understanding, key goals
2. Our Approach: methodology, phases, team structure
3. Technical Architecture: proposed stack, integrations, hosting
4. Scope of Work: what is included (summary level, not line-item estimates)
5. Assumptions & Exclusions: key assumptions that define scope boundaries
6. Timeline: indicative milestone schedule
7. Why Us: relevant experience, capability highlights

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

Write output to claude-artefacts/estimate-review.md following the estimate-review-template.md structure.`;
}

export function getPhase4Prompt(): string {
  return `Conduct Phase 4: Gap Analysis & Revised Estimates.

Based on the Phase 3 estimate review, produce:

1. A gap analysis mapping every TOR requirement to its estimate line item (or flagging it as MISSING).
2. Revised estimates where gaps or misalignments were identified.
3. A risk summary for all flagged items.

Write outputs:
- claude-artefacts/gap-analysis.md (following gap-analysis-template.md)
- claude-artefacts/revised-estimates.md`;
}
