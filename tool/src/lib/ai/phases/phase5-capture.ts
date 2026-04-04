import { PhaseConfig } from "@/lib/ai/agent";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";

function getPhase5Prompt(): string {
  return `Conduct Phase 5: Knowledge Capture (Post-Engagement).

Start by reading all artefacts produced during this engagement — research, TOR assessment, estimates, responses, gap analysis — to build a complete picture of the workflow.

## Part 1: Engagement Summary

Produce a concise summary of the full engagement flow:
- **Client & Project**: Name, tech stack, engagement type
- **Phases Completed**: Which phases ran, which were skipped, which path was taken (no-response / has-response)
- **Key Metrics**: Total estimated hours (low/high), requirement count, risk count, assumption count
- **Timeline**: When each phase started and completed

## Part 2: Knowledge Capture

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

## Part 3: Actionable Insights

For EACH insight, clearly state:
- **Insight**: What was learned
- **Applies to**: Which phase(s) this could improve (Research, TOR Assessment, Estimation, etc.)
- **Recommendation**: Specific action to take in future engagements
- **Confidence**: How confident you are this is generalizable (High / Medium / Low)

Focus on insights that are GENERIC and reusable across engagements, not specific to this client.
Flag any insight with Low confidence for human review.

Write output to claude-artefacts/knowledge-capture.md with sections:
- Engagement Summary
- Estimation Variances (actual vs estimated)
- Reusable Question Patterns
- Client & Industry Patterns
- Benchmark Updates
- Actionable Insights (with per-insight confidence ratings)
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
