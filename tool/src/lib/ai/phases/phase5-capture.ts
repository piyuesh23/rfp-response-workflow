import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";

function getPhase5ProposalPrompt(): string {
  return `Generate Phase 5: Client-Facing Technical Proposal Document.

Start by reading ALL artefacts produced during this engagement to build the full context:
- TOR document(s) in tor/
- Research output in research/
- TOR assessment in claude-artefacts/
- Estimates (optimistic or revised) in estimates/
- Customer responses in responses_qna/ (if available — HAS_RESPONSE path)
- Gap analysis in claude-artefacts/ (if available — HAS_RESPONSE path)

## Proposal Structure

Write a professional, client-facing technical proposal covering:

### 1. Executive Summary
- Project understanding and key business goals
- High-level solution overview
- Key differentiators of our approach

### 2. Our Approach
- Development methodology (Agile/Scrum phases)
- Team structure and roles
- Communication and reporting cadence
- Quality assurance strategy

### 3. Technical Architecture
- Proposed technology stack with justification
- System architecture (monolith, decoupled, microservices as appropriate)
- Integration architecture for all third-party systems
- Hosting and infrastructure recommendations
- Security and performance considerations

### 4. Scope of Work
- Summarise deliverables at module/feature level (NOT line-item estimates)
- Group by functional area (content, integrations, frontend, DevOps, etc.)
- Clearly state what is IN scope and OUT of scope
- Reference engagement type (migration, new build, redesign, enhancement)

### 5. Assumptions & Exclusions
- List all assumptions that define scope boundaries
- Each assumption should be phrased as a change-request boundary
- Clearly state what is excluded and why
- Reference TOR sections or customer Q&A responses for each assumption

### 6. Timeline & Milestones
- Indicative milestone schedule with phases
- Key dependencies and critical path items
- Go-live criteria and hypercare period

### 7. Risk Summary
- Top risks from the estimation process (Conf ≤ 4 items)
- Mitigation strategies for each risk
- Dependencies requiring client action

### 8. Investment Summary
- Present effort ranges (Low Hrs / High Hrs) at summary level by category
- Do NOT include detailed line-item pricing
- Note which items carry higher uncertainty and why

### 9. Why Us
- Relevant experience and capability highlights
- Similar project references (if known from research)

## Important Guidelines
- This is a CLIENT-FACING document — use professional, non-technical language where possible
- Do NOT reference internal artefact IDs, phase numbers, or tooling details
- Do NOT include raw estimate tables — summarise at category level
- Assumptions must reference TOR clauses or customer Q&A, never internal analysis
- Tone: confident, consultative, partnership-oriented

Write output to claude-artefacts/technical-proposal.md following the technical-proposal-template.md structure if available.`;
}

export function getPhase5Config(
  engagementId: string,
  techStack: string
): PhaseConfig {
  return {
    engagementId,
    phase: 5,
    techStack,
    tools: ["Read", "Write"],
    maxTurns: 40,
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      "You are generating a client-facing technical proposal based on all prior engagement analysis and estimates.",
    ].join("\n\n---\n\n"),
    userPrompt: getPhase5ProposalPrompt(),
  };
}
