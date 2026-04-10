import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";

function getPhase5ProposalPrompt(engagementType?: string): string {
  const isDiscovery = engagementType === "DISCOVERY";
  const proposalType = isDiscovery ? "Discovery Proposal" : "Technical Proposal";

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
- **Solution architecture document in claude-artefacts/solution-architecture.md** (if available — this is the pre-approved technical foundation)
- Estimates (optimistic or revised) in estimates/
- Customer responses in responses_qna/ (if available)
- Gap analysis in claude-artefacts/ (if available)

## Solution Architecture Alignment

If a solution architecture document exists (claude-artefacts/solution-architecture.md), your proposal MUST:
- **EXPAND** the solution architecture sections into polished narrative prose — add depth, diagrams, and business rationale
- **NOT contradict or reinvent** decisions already documented in the solution doc
- **Preserve all technology choices**, integration approaches, and infrastructure decisions from the solution doc
- **Reference estimate hours** at summary level to support the investment section
- The solution doc is the pre-approved technical foundation — the proposal makes it client-ready

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

#### 4.3 Migration Strategy (if applicable)
If this is a migration or redesign engagement, include a Mermaid gantt chart showing migration phases. Describe the migration approach in 3-4 numbered steps. Cover URL preservation and SEO considerations.

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
Group assumptions by category (Content & Architecture, Integrations, Infrastructure, Process). Each assumption should state what is assumed and the impact if the assumption is wrong, referencing TOR sections.

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
  engagementType?: string
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
