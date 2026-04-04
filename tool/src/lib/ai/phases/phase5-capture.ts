import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";

function getPhase5Prompt(): string {
  return `Conduct Phase 5: Knowledge Capture (Post-Engagement).

Review all artefacts produced during this engagement and capture key learnings for future estimation calibration.

1. Compare actual vs estimated effort where data is available.
   - Identify line items that were significantly over or under estimated.
   - Note the root cause (unclear requirements, integration complexity, scope creep, etc.).

2. Extract reusable question patterns.
   - Which clarifying questions uncovered the most hidden scope?
   - Which requirement areas were consistently under-specified?

3. Record client-specific patterns.
   - Industry-specific complexity factors observed.
   - Platform or integration gotchas specific to this engagement.

4. Update benchmark data.
   - Propose additions or corrections to benchmarks/ reference ranges based on actual effort.
   - Format: Task Type | Category | Low Hrs | High Hrs | Notes | Source Engagement.

5. Store observations via claude-mem for future retrieval.
   - Tag observations with: tech stack, industry, engagement type, integration types.
   - Ensure observations are searchable by future engagements with similar profiles.

Write output to claude-artefacts/knowledge-capture.md with sections:
- Estimation Variances (actual vs estimated)
- Reusable Question Patterns
- Client & Industry Patterns
- Benchmark Updates
- Recommendations for Future Engagements`;
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
    maxTurns: 30,
    systemPrompt: [
      getBaseSystemPrompt(techStack),
      getCarlRules(),
      "You are capturing key learnings from this engagement for future estimation calibration",
    ].join("\n\n---\n\n"),
    userPrompt: getPhase5Prompt(),
  };
}
