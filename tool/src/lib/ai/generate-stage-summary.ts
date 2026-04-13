/**
 * Generate AI-powered summaries for each phase of an engagement.
 * Uses Haiku for cost efficiency (~$0.01 per summary).
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

const HAIKU_MODEL = "claude-haiku-4-20250514";

export async function generateStageSummary(
  engagementId: string,
  phaseNumber: string
): Promise<void> {
  // Fetch all artefacts for this engagement + phase
  const phase = await prisma.phase.findFirst({
    where: { engagementId, phaseNumber },
    include: {
      artefacts: {
        select: { contentMd: true, artefactType: true, label: true },
      },
    },
  });

  if (!phase || phase.artefacts.length === 0) return;

  // Concatenate content, truncated to 8000 chars total
  let combinedText = "";
  for (const art of phase.artefacts) {
    if (!art.contentMd) continue;
    const remaining = 8000 - combinedText.length;
    if (remaining <= 0) break;
    combinedText += `\n--- ${art.artefactType}: ${art.label ?? "Untitled"} ---\n`;
    combinedText += art.contentMd.slice(0, remaining);
  }

  if (combinedText.length < 50) return;

  const anthropic = new Anthropic();

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 500,
      system: `You are a presales analyst summarizing documents from a specific phase of an RFP engagement.

Generate a concise summary with:
1. A 2-3 sentence overview of what this phase contains
2. Key findings (up to 5 bullet points)
3. Identified risks (up to 3 items)
4. Important decisions or constraints noted (up to 3 items)

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview",
  "keyFindings": {
    "requirements": ["..."],
    "risks": ["..."],
    "decisions": ["..."]
  }
}`,
      messages: [
        {
          role: "user",
          content: `Summarize these Phase ${phaseNumber} documents:\n\n${combinedText}`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary: string;
      keyFindings?: Record<string, string[]>;
    };

    await prisma.engagementStageSummary.upsert({
      where: {
        engagementId_phaseNumber: { engagementId, phaseNumber },
      },
      update: {
        summary: parsed.summary,
        documentCount: phase.artefacts.length,
        keyFindings: parsed.keyFindings
          ? JSON.parse(JSON.stringify(parsed.keyFindings))
          : undefined,
        generatedAt: new Date(),
      },
      create: {
        engagementId,
        phaseNumber,
        summary: parsed.summary,
        documentCount: phase.artefacts.length,
        keyFindings: parsed.keyFindings
          ? JSON.parse(JSON.stringify(parsed.keyFindings))
          : null,
      },
    });
  } catch (err) {
    console.warn(
      `[stage-summary] Failed to generate summary for engagement ${engagementId} phase ${phaseNumber}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Generate summaries for all phases that have artefacts for a given engagement.
 * Fire-and-forget — errors are logged but don't propagate.
 */
export async function generateAllStageSummaries(
  engagementId: string
): Promise<void> {
  const phases = await prisma.phase.findMany({
    where: { engagementId },
    select: { phaseNumber: true, artefacts: { select: { id: true } } },
  });

  const phasesWithArtefacts = phases.filter((p) => p.artefacts.length > 0);

  await Promise.allSettled(
    phasesWithArtefacts.map((p) =>
      generateStageSummary(engagementId, p.phaseNumber)
    )
  );
}
