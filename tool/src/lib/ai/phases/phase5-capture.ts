import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import type { EngagementType } from "@/generated/prisma/enums";

interface Section43Block {
  title: string;
  directive: string;
}

export function getSection43Block(engagementType?: EngagementType | string): Section43Block {
  switch (engagementType) {
    case "MIGRATION":
      return {
        title: "4.3 Data Migration Strategy",
        directive: `Describe the end-to-end data migration approach for this engagement. Include a Mermaid gantt chart showing migration phases (extract, transform, load, reconciliation, cutover). Describe the migration approach in 3-4 numbered steps covering source system inventory, mapping, iterative dry-runs, and final cutover. Cover URL preservation with 301 redirect strategy and SEO considerations (canonical tags, sitemap regeneration, search console resubmission).

\`\`\`mermaid
gantt
    title Data Migration Timeline
    dateFormat YYYY-MM-DD
    section Preparation
        Source Audit           :a1, 2026-01-01, 10d
        Mapping Spec           :a2, after a1, 7d
    section Execution
        Dry-Run Migration      :b1, after a2, 14d
        Reconciliation         :b2, after b1, 7d
    section Cutover
        Final Migration        :c1, after b2, 5d
        Redirect Validation    :c2, after c1, 3d
\`\`\``,
      };
    case "REDESIGN":
      return {
        title: "4.3 Content and URL Migration Plan",
        directive: `Describe the phased content migration and redesign transition approach. Include a Mermaid gantt chart showing content migration phases alongside template refactor milestones. Cover: (1) content inventory and prioritization, (2) URL mapping strategy with a Source URL -> Target URL table example, (3) SEO redirect plan (301 rules, redirect map deployment, canonical tag updates, XML sitemap regeneration), and (4) template refactor approach (parallel build vs. in-place refactor tradeoff, feature parity validation).

\`\`\`mermaid
gantt
    title Content & URL Migration
    dateFormat YYYY-MM-DD
    section Content
        Inventory & Audit      :a1, 2026-01-01, 10d
        Priority Migration     :a2, after a1, 21d
    section URL Strategy
        URL Mapping            :b1, 2026-01-08, 14d
        Redirect Rules         :b2, after b1, 7d
    section Templates
        Template Refactor      :c1, 2026-01-15, 28d
        Parity QA              :c2, after c1, 10d
\`\`\``,
      };
    case "ENHANCEMENT":
      return {
        title: "4.3 Incremental Rollout",
        directive: `Describe the incremental rollout approach for enhancing the existing platform. Include a Mermaid flowchart showing the feature-flag-driven release pipeline. Cover: (1) feature-flagging strategy (platform/tooling, flag lifecycle, kill-switch pattern), (2) beta cohort selection (internal users, opt-in segment, percentage rollout), (3) backwards compatibility guarantees (API versioning, DB schema additive changes, dual-write windows), and (4) phased release gates (canary -> 10% -> 50% -> 100%) with rollback criteria.

\`\`\`mermaid
flowchart LR
    A["Feature Branch"] --> B["Flag: OFF in Prod"]
    B --> C["Internal Beta"]
    C --> D["Opt-In Cohort"]
    D --> E["10% Rollout"]
    E --> F["50% Rollout"]
    F --> G["100% GA"]
    E -.->|"rollback"| B
    F -.->|"rollback"| B
\`\`\``,
      };
    case "DISCOVERY":
      return {
        title: "4.3 Recommendations Roadmap",
        directive: `Describe the prioritized recommendations roadmap produced by this discovery engagement. Include a Mermaid flowchart (or swim-lane) mapping recommendation themes to phased implementation waves. Cover: (1) prioritized recommendations grouped by theme (Quick Wins, Strategic Investments, Foundational Remediations), (2) phased implementation plan (Phase 1 / Phase 2 / Phase 3) derived from the assessment findings with indicative effort bands, (3) success metrics for each phase (leading and lagging indicators, measurement cadence), and (4) dependencies and sequencing rationale.

\`\`\`mermaid
flowchart TD
    A["Assessment Findings"] --> B["Phase 1: Quick Wins (0-3 months)"]
    A --> C["Phase 2: Strategic Investments (3-9 months)"]
    A --> D["Phase 3: Foundational Remediations (9-18 months)"]
    B --> E["KPI: Time-to-Value"]
    C --> F["KPI: Capability Uplift"]
    D --> G["KPI: Platform Resilience"]
\`\`\``,
      };
    case "NEW_BUILD":
    default:
      return {
        title: "4.3 Rollout & Adoption",
        directive: `Describe the launch and adoption plan for this new build. Include a Mermaid flowchart (or swim-lane) of the phased launch path from soft-launch to general availability. Cover: (1) phased launch plan (internal pilot -> stakeholder preview -> soft launch -> public GA) with entry/exit criteria per gate, (2) stakeholder training approach (role-based tracks, content formats, train-the-trainer, reference materials), (3) change management (comms plan, champions network, feedback loops, support model during hypercare), and (4) success metrics during onboarding (adoption rate, time-to-first-value, task completion, support ticket volume).

\`\`\`mermaid
flowchart LR
    A["Internal Pilot"] --> B["Stakeholder Preview"]
    B --> C["Soft Launch"]
    C --> D["General Availability"]
    A -.->|"Training Wave 1"| T1["Admins"]
    B -.->|"Training Wave 2"| T2["Power Users"]
    C -.->|"Training Wave 3"| T3["End Users"]
    D --> M["Adoption Metrics & Hypercare"]
\`\`\``,
      };
  }
}

function getPhase5ProposalPrompt(engagementType?: EngagementType | string): string {
  const isDiscovery = engagementType === "DISCOVERY";
  const proposalType = isDiscovery ? "Discovery Proposal" : "Technical Proposal";
  const section43 = getSection43Block(engagementType);

  return `Generate Phase 5: Client-Facing ${proposalType} Document.${isDiscovery ? `

**DISCOVERY ENGAGEMENT:** This proposal describes a discovery/assessment engagement, NOT a build project. Adapt all sections accordingly:
- "Solution Approach" becomes "Discovery Approach" (workshops, research, analysis activities)
- "Phased Delivery Plan" becomes "Discovery Phase Plan" (kick-off → research → analysis → synthesis → presentation)
- "Investment Summary" covers discovery effort (workshops, architecture review, PoCs, documentation), not build effort
- "In-Scope" lists discovery deliverables (assessment report, architecture document, wireframes, PoC results, recommendations deck)
- Team composition reflects discovery roles (lead architect, BA/analyst, UX researcher, technical writer)
` : ""}

Start by reading ALL artefacts produced during this engagement to build the full context:
- TOR document(s) in tor/
- Research output in research/ (customer background, site audit, tech stack discovery)
- TOR assessment in claude-artefacts/
- **Solution architecture document in claude-artefacts/solution-architecture.md** (MANDATORY — pre-approved technical foundation)
- Estimates (optimistic or revised) in estimates/
- Customer responses in responses_qna/ (if available)
- Gap analysis in claude-artefacts/ (if available)

## Mandatory Prerequisite: solution-architecture.md

You MUST read \`claude-artefacts/solution-architecture.md\` BEFORE writing any proposal content. It is the pre-approved technical anchor that every downstream phase revises; the proposal extends it rather than re-inventing it.

**If the file is missing, stop immediately.** Do NOT continue writing the proposal. Instead:

1. Emit a single artefact at \`claude-artefacts/PROPOSAL_BLOCKED.md\` with the following content:

\`\`\`
# Proposal Blocked — Missing Prerequisite

The Phase 5 proposal generator requires \`claude-artefacts/solution-architecture.md\` as input, but this file was not found in the engagement workspace.

## Why this is required

The solution architecture document is drafted in Phase 1 (v0) and revised by Phase 1A and Phase 3. It is the pre-approved technical foundation the proposal expands into client-ready narrative. Without it, the proposal has no anchor for technology choices, integrations, or infrastructure — every section would risk contradicting earlier phases.

## Remediation

Re-run Phase 1 (or Phase 1A / Phase 3) to produce \`claude-artefacts/solution-architecture.md\`, then re-queue Phase 5.
\`\`\`

2. Do NOT write \`claude-artefacts/technical-proposal.md\`.
3. End the run after writing PROPOSAL_BLOCKED.md.

## Solution Architecture Alignment

Assuming the solution architecture document is present, your proposal MUST:
- **EXPAND** the solution architecture sections into polished narrative prose — add depth, diagrams, and business rationale
- **NOT contradict or reinvent** decisions already documented in the solution doc
- **Preserve all technology choices**, integration approaches, and infrastructure decisions from the solution doc
- **Reference estimate hours** at summary level to support the investment section
- The solution doc is the pre-approved technical foundation — the proposal makes it client-ready

## Mandatory Carry-Forward Requirements

Before writing, extract from the estimate file (estimates/optimistic-estimate.md or estimates/revised-estimate.md):
1. ALL assumptions listed in the Assumption Register — every single one MUST appear in Section 7.3 (Key Assumptions), grouped by category
2. ALL Risk Register items — summarize in client-appropriate language in Section 7.4 (Risk Summary)
3. ALL integration tier classifications (T1/T2/T3) — reference each integration with its tier in Section 4.2

Self-check before writing final output:
- Section 7.3 assumption count >= estimate Assumption Register count
- Section 7.4 risk items >= estimate Risk Register count
- Section 4.2 mentions every integration from the estimate with its tier classification
- Section 3 references architecture decisions from solution-architecture.md

## Writing Style

This is a PROFESSIONAL TECHNICAL PROPOSAL. Write in flowing narrative prose with substantive depth.
- Use PARAGRAPHS, not bullet lists. Each section should read as connected, reasoned prose.
- Include specific technical details: module names, API patterns, configuration approaches.
- Every architectural decision must include a "why" rationale tied to the TOR requirements.
- Use Mermaid diagrams (graph, flowchart, stateDiagram, gantt) for architecture, workflows, integrations, and timelines.
- Use tables for structured comparisons (tech stack, integrations, team, timeline phases).
- Do NOT use generic filler like "best practices" or "industry standard" without specifics.
- Do NOT use em-dashes, semicolons, or emoji.
- Reference specific TOR requirements by section/clause when justifying decisions.

## Proposal Structure

### 1. Executive Summary (2-3 paragraphs)
Write a narrative summary that demonstrates deep understanding of the client's business context, the project's strategic goals, and QED42's proposed solution. Reference the client by name. State the recommended technology platform with a one-sentence justification. Mention the key engagement scope (number of integrations, content types, migration complexity). End with a confidence statement about delivery capability, referencing relevant experience.

### 2. Understanding of Requirements

#### 2.1 Business Context
Write 2-3 paragraphs demonstrating understanding of the client's organization, industry, digital presence, and the business drivers behind this project. Draw from Phase 0 research.

#### 2.2 Project Objectives
Identify 3-5 primary objectives from the TOR. Each objective should be a concise statement with a brief explanation of what success looks like. Use a descriptive format, not bare bullet points.

#### 2.3 Key Success Criteria
Present as a table with columns: Criterion | Measurement. Each criterion must be specific and measurable (e.g., "LCP < 2.5s on mobile" not "good performance").

### 3. Proposed Architecture

#### 3.1 Architecture Overview
Write 2-3 paragraphs explaining the recommended architecture approach (coupled, decoupled, headless, etc.) with clear rationale for WHY this approach suits the TOR requirements. Include a Mermaid diagram showing the high-level system architecture with all components and integrations.

\`\`\`mermaid
graph TD
    subgraph External ["External Services"]
        ...
    end
    subgraph Platform ["Platform"]
        ...
    end
    subgraph Integrations ["Third-Party Integrations"]
        ...
    end
\`\`\`

#### 3.2 Technology Stack
Present as a table with columns: Layer | Technology | Rationale. Cover: CMS/Backend, Frontend, Page Building, Search, Hosting, CDN/WAF, CI/CD, Dependency Management.

#### 3.3 Architecture Decisions
For each major decision (architecture style, hosting model, multi-site approach, etc.), write a paragraph with the format:
- **Why [chosen approach] (not [alternative])?** followed by a technical justification referencing TOR requirements and cost/complexity tradeoffs.

### 4. Solution Approach

#### 4.1 Content Architecture
Detail content types as a table (Content Type | Key Fields | Platform Approach). Describe the editorial workflow with a Mermaid state diagram. Cover taxonomy, media management, and content organization.

\`\`\`mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review
    Review --> Published
    ...
\`\`\`

#### 4.2 Integrations
Show a Mermaid flowchart of all integration touchpoints. Then present each integration as a table row with columns: System | Integration Approach. Write 1-2 sentences per integration explaining the specific technical approach, not generic descriptions.

\`\`\`mermaid
flowchart LR
    subgraph DXP ["Platform"]
        ...
    end
    subgraph External ["External Systems"]
        ...
    end
\`\`\`

#### ${section43.title}
${section43.directive}

#### 4.4 Frontend / User Experience
Describe the theme architecture, component library (as a table mapping components to requirements), and mobile-first approach. Include a Mermaid diagram showing the component composition model if relevant.

#### 4.5 DevOps & Infrastructure
Cover environments (table: Environment | Purpose | Access), CI/CD pipeline (Mermaid flowchart), configuration management, and hosting capabilities.

\`\`\`mermaid
flowchart LR
    A["Git Push"] --> B["CI Pipeline"]
    B --> C["Build"]
    C --> D["Test"]
    D --> E["Deploy"]
\`\`\`

#### 4.6 SEO, Accessibility & Performance
Write technical specifics for each area. Reference specific modules, tools, and standards (WCAG level, Core Web Vitals thresholds, Schema.org types).

#### 4.7 Security
Cover application security, data protection, logging/monitoring, and access controls with specific technical approaches.

### 5. Delivery Approach

#### 5.1 Methodology
Describe the development methodology with specific cadences (sprint length, ceremony schedule, communication channels).

#### 5.2 Phased Delivery Plan
Include a Mermaid gantt chart showing all project phases with realistic durations. Then present a table with columns: Phase | Duration | Key Deliverables.

\`\`\`mermaid
gantt
    title Project Delivery Timeline
    dateFormat YYYY-MM-DD
    section Discovery
        ...
    section Build
        ...
    section Quality
        ...
    section Launch
        ...
\`\`\`

#### 5.3 Timeline Summary
State estimated total duration, start date assumption, and target go-live.

### 6. Team Composition
Present as a table: Role | Seniority | Allocation | Responsibilities. State peak and average team size.

### 7. Assumptions & Scope Boundaries

#### 7.1 In-Scope
List all deliverables included in this engagement as a comprehensive bulleted list.

#### 7.2 Recommended for Phase 2
Present as a table: Item | Why Phase 2. These are items identified in the TOR or research that are better addressed after the initial launch.

#### 7.3 Key Assumptions
Group assumptions by category (Content & Architecture, Integrations, Infrastructure, Process). Each assumption should state what is assumed and the impact if the assumption is wrong, referencing TOR sections. EVERY assumption from the estimate Assumption Register must appear here.

#### 7.4 Risk Summary
Present a client-facing risk table with columns: Area | Risk | Mitigation Approach | Impact Level (High/Medium/Low).
Include ALL items from the estimate Risk Register, rephrased for client consumption (no internal references, no Conf scores).
Add any additional risks identified during proposal writing.

### 8. Investment Summary
Present effort at summary level by category (Backend, Frontend, Fixed Cost, AI if applicable) with Low/High hour ranges. Do NOT include line-item detail. Note items with higher uncertainty.

### 9. Why QED42
Write 2-3 paragraphs about relevant experience, technical capabilities, and team strengths. Reference similar projects if known from research.

## Output

Write the complete proposal to claude-artefacts/technical-proposal.md. The document should be 3000-5000 words of substantive, technical content (not filler). Every section must add value. Include at least 4-5 Mermaid diagrams throughout.`;
}

export function getPhase5Config(
  engagementId: string,
  techStack: string,
  engagementType?: EngagementType | string
): PhaseConfig {
  return {
    engagementId,
    phase: 5,
    techStack,
    tools: ["Read", "Write"],
    maxTurns: 60,
    model: "claude-opus-4-20250514",
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      "You are a Senior Technical Architect writing a client-facing technical proposal. Your proposals are deeply technical, well-structured narrative documents with architecture diagrams, decision rationale, and specific implementation details. You write in flowing prose, not bullet-point lists.",
    ].join("\n\n---\n\n"),
    userPrompt: getPhase5ProposalPrompt(engagementType),
  };
}
