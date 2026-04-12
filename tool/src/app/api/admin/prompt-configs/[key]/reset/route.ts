import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import { getBaseSystemPrompt } from "@/lib/ai/prompts/system-base";
import { getCarlRules } from "@/lib/ai/prompts/carl-rules";
import {
  getPhase0Prompt,
  getPhase1Prompt,
  getPhase1AEstimatePrompt,
  getPhase1AProposalPrompt,
  getPhase2Prompt,
  getPhase3Prompt,
  getPhase4Prompt,
} from "@/lib/ai/prompts/phase-prompts";

// Resolve a key to its hardcoded default content.
async function resolveDefault(key: string): Promise<string | null> {
  if (key === "system-base") return getBaseSystemPrompt("{{techStack}}");
  if (key === "carl-rules") return getCarlRules();
  if (key === "phase-0") return getPhase0Prompt("{{engagementType}}");
  if (key === "phase-1") return getPhase1Prompt();
  if (key === "phase-1a-estimate")
    return getPhase1AEstimatePrompt("{{techStack}}", "{{engagementType}}");
  if (key === "phase-2") return getPhase2Prompt();
  if (key === "phase-3") return getPhase3Prompt();
  if (key === "phase-4") return getPhase4Prompt();
  if (key === "phase-5") return getPhase1AProposalPrompt("{{engagementType}}");

  // benchmark-* keys: read from ../../benchmarks/{name}.md
  if (key.startsWith("benchmark-")) {
    const name = key.slice("benchmark-".length);
    const filePath = path.resolve(
      process.cwd(),
      "../../benchmarks",
      `${name}.md`
    );
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  // template-* keys: read from ../../templates/{name}.md
  if (key.startsWith("template-")) {
    const name = key.slice("template-".length);
    const filePath = path.resolve(
      process.cwd(),
      "../../templates",
      `${name}.md`
    );
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  return null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { key } = await params;

  const existing = await prisma.promptConfig.findUnique({ where: { key } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const defaultContent = await resolveDefault(key);
  if (defaultContent === null) {
    return NextResponse.json(
      { error: `No hardcoded default found for key: ${key}` },
      { status: 422 }
    );
  }

  // Snapshot current content as a version before resetting
  await prisma.promptVersion.create({
    data: {
      promptConfigId: existing.id,
      content: existing.content,
      changedBy: session.user.email ?? session.user.id,
      changeNote: `Reset to default`,
    },
  });

  const updated = await prisma.promptConfig.update({
    where: { key },
    data: {
      content: defaultContent,
      isDefault: true,
      updatedBy: session.user.email ?? session.user.id,
    },
  });

  return NextResponse.json(updated);
}
