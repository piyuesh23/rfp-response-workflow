/**
 * Gap-fix worker.
 *
 * Listens to the "gap-fix" BullMQ queue. Each job represents one user-triggered
 * pass to patch an existing estimate: adds missing TOR line items, corrects Conf
 * formula violations, adds orphan justifications, and fills risk register gaps.
 *
 * After the AI agent finishes patching, a fresh validateEstimateFull() run
 * replaces the engagement's ValidationReport so the accuracy score updates.
 */
import { Worker } from "bullmq";
import { runPhase, prepareWorkDir, syncFilesToStorage } from "@/lib/ai/agent";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { getFixGapsPrompt } from "@/lib/ai/prompts/phase-prompts";
import { prisma } from "@/lib/db";
import { redisConnection, GapFixJobData } from "@/lib/queue";
import { getLatestValidationReportsByPhase } from "@/lib/accuracy";
import type { PhaseConfig } from "@/lib/ai/agent";
import * as fs from "fs/promises";
import * as path from "path";

const SONNET_MODEL = "claude-sonnet-4-20250514";

const worker = new Worker<GapFixJobData>(
  "gap-fix",
  async (job) => {
    const { gapFixRunId, engagementId, techStack } = job.data;

    await prisma.gapFixRun.update({
      where: { id: gapFixRunId },
      data: { status: "RUNNING" },
    });

    try {
      // Load the engagement work directory
      const workDir = await prepareWorkDir(engagementId);

      // Load the current estimate file
      const estimatePath = path.join(workDir, "estimates/optimistic-estimate.md");
      let estimateContent = "";
      try {
        estimateContent = await fs.readFile(estimatePath, "utf-8");
      } catch {
        throw new Error("No estimate file found at estimates/optimistic-estimate.md — run Phase 1A first.");
      }

      // Load gap data from the GapFixRun snapshot
      const run = await prisma.gapFixRun.findUnique({
        where: { id: gapFixRunId },
        select: { gapsBefore: true },
      });
      if (!run) throw new Error(`GapFixRun ${gapFixRunId} not found`);

      const gapsBefore = run.gapsBefore as {
        phaseNumber: string;
        details: Record<string, unknown>;
      };

      // Extract structured gap details from the ValidationReport details JSON
      const details = gapsBefore.details as Record<string, { items?: unknown[] }>;
      const gapItems = (details?.gaps?.items ?? []) as Array<{ id: string; clauseRef: string; title: string; domain?: string }>;
      const orphanItems = (details?.orphans?.items ?? []) as Array<{ id: string; tab: string; task: string }>;
      const confItems = (details?.confViolations?.items ?? []) as Array<{ id: string; tab: string; task: string; hours: number; conf: number; expectedHigh: number; actualHigh: number }>;
      const riskItems = (details?.missingRiskItems?.items ?? []) as Array<{ id: string; tab: string; task: string; conf: number }>;

      // Build the fix-gaps prompt
      const engagement = await prisma.engagement.findUnique({
        where: { id: engagementId },
        select: { engagementType: true, techStackCustom: true },
      });

      const userPrompt = getFixGapsPrompt({
        gaps: gapItems,
        orphans: orphanItems,
        confViolations: confItems,
        missingRiskItems: riskItems,
        techStack,
        techStackCustom: engagement?.techStackCustom ?? undefined,
        engagementType: engagement?.engagementType ?? undefined,
      });

      const config: PhaseConfig = {
        engagementId,
        phase: 0, // sentinel — not a real phase number
        techStack,
        tools: ["Read", "Write", "Glob"],
        maxTurns: 30,
        systemPrompt: `You are a senior ${techStack} architect patching a presales estimate. You patch only what is listed — do not restructure, rewrite, or remove anything else. You work inside the directory /data/engagements/${engagementId}.`,
        userPrompt,
        model: SONNET_MODEL,
      };

      await job.updateProgress({
        type: "progress",
        tool: "Gap Fix Agent",
        message: `Starting gap fix — ${gapItems.length} gaps, ${orphanItems.length} orphans, ${confItems.length} conf violations, ${riskItems.length} missing risk entries`,
      });

      for await (const event of runPhase(config)) {
        await job.updateProgress(event);
        if (event.type === "error") {
          console.error(`[gap-fix] Agent error: ${event.message}`);
        }
      }

      await job.updateProgress({
        type: "progress",
        tool: "Gap Fix Agent",
        message: "Patch complete — syncing files and re-running validation...",
      });

      // Sync patched files back to storage
      try {
        await syncFilesToStorage(engagementId, workDir);
      } catch (err) {
        console.warn(`[gap-fix] Storage sync failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
      }

      // Re-run full validation so the accuracy score updates
      const patchedEstimate = await fs.readFile(estimatePath, "utf-8").catch(() => "");

      if (patchedEstimate.trim().length > 100) {
        try {
          await validateEstimateFull(
            patchedEstimate,
            techStack,
            engagementId,
            gapsBefore.phaseNumber ?? "1A"
          );
        } catch (err) {
          console.warn(`[gap-fix] Validation re-run failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Snapshot updated scores
      const updatedReports = await getLatestValidationReportsByPhase(engagementId);
      const scoresAfter = Object.entries(updatedReports)
        .filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] != null)
        .map(([phase, rep]) => ({
          phaseNumber: phase,
          accuracyScore: rep.accuracyScore,
        }));

      await prisma.gapFixRun.update({
        where: { id: gapFixRunId },
        data: {
          status: "DONE",
          scoresAfter,
          completedAt: new Date(),
        },
      });

      await job.updateProgress({
        type: "complete",
        message: "Gap fix complete. Accuracy score updated.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[gap-fix] Run ${gapFixRunId} failed: ${message}`);

      await prisma.gapFixRun.update({
        where: { id: gapFixRunId },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      });

      throw err;
    }
  },
  {
    concurrency: 2,
    connection: redisConnection,
  }
);

export default worker;
