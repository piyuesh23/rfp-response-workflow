/**
 * Gap-fix worker.
 *
 * After the AI agent patches the estimate markdown, this worker re-syncs
 * LineItem DB rows from the updated sidecar JSON (same logic as phase-runner
 * Phase 1A/3) so that the structured validators query fresh data and the
 * accuracy score reflects the actual changes.
 */
import { Worker } from "bullmq";
import { runPhase, prepareWorkDir, syncFilesToStorage } from "@/lib/ai/agent";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { extractEstimateSidecar, normalizeClauseRef } from "@/lib/ai/sidecar-extractors";
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
      const workDir = await prepareWorkDir(engagementId);
      const estimatePath = path.join(workDir, "estimates/optimistic-estimate.md");

      try {
        await fs.access(estimatePath);
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
        details: {
          coverage?: { details?: { gaps?: unknown[]; orphans?: unknown[] } };
          confFormula?: { details?: { violations?: unknown[] } };
          riskRegister?: { details?: { missing?: unknown[] } };
        };
      };

      // ValidationReport.details shape: { coverage, confFormula, riskRegister, ... }
      // each key contains { details: { ... } } from the individual validator result.
      const det = gapsBefore.details ?? {};
      const gapItems = (det.coverage?.details?.gaps ?? []) as Array<{ id: string; clauseRef: string; title: string; domain?: string }>;
      const orphanItems = (det.coverage?.details?.orphans ?? []) as Array<{ id: string; tab: string; task: string }>;
      // conf violations shape from validators/conf-formula: { id, task, tab, field, expected, actual }
      const confItems = (det.confFormula?.details?.violations ?? []) as Array<{ id: string; tab: string; task: string; field: string; expected: number; actual: number }>;
      // risk register missing shape: { id, task, conf }
      const riskItems = (det.riskRegister?.details?.missing ?? []) as Array<{ id: string; task: string; conf: number }>;

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
        phase: 0,
        techStack,
        tools: ["Read", "Write"],
        maxTurns: 15,
        systemPrompt: `You are a senior ${techStack} architect patching a presales estimate. You patch only what is listed — do not restructure, rewrite, or remove anything else. You work inside the directory /data/engagements/${engagementId}. Be efficient: read estimates/optimistic-estimate.md ONCE at the start, then make ALL edits in a single Write call. Do NOT re-read the TOR — the issue list below already contains every clause ref and title you need. Do NOT read other files.`,
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
        message: "Patch complete — syncing LineItem rows to DB...",
      });

      // Sync patched files to storage (non-fatal)
      try {
        await syncFilesToStorage(engagementId, workDir);
      } catch (err) {
        console.warn(`[gap-fix] Storage sync failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
      }

      // --- Critical: re-sync LineItem DB rows from the patched sidecar ---
      // The structured validators (coverage, conf-formula, etc.) read from
      // TorRequirement / LineItem DB tables, NOT the markdown file. Without
      // this sync, validateEstimateFull queries stale rows and the score
      // doesn't change.
      const patchedEstimate = await fs.readFile(estimatePath, "utf-8").catch(() => "");
      if (patchedEstimate.trim().length > 100) {
        try {
          const sidecar = extractEstimateSidecar(patchedEstimate);
          if (sidecar && sidecar.lineItems.length > 0) {
            // Build TorRequirement lookup for clause-ref → id resolution
            const existingRequirements = await prisma.torRequirement.findMany({
              where: { engagementId },
              select: { id: true, normalizedClauseRef: true },
            });
            const reqByNormalized = new Map<string, string>();
            for (const r of existingRequirements) {
              reqByNormalized.set(r.normalizedClauseRef, r.id);
            }

            // Replace all LineItem rows for this engagement
            await prisma.lineItem.deleteMany({ where: { engagementId } });

            for (const li of sidecar.lineItems) {
              const torIds: string[] = [];
              for (const ref of li.torClauseRefs ?? []) {
                const id = reqByNormalized.get(normalizeClauseRef(ref));
                if (id) torIds.push(id);
              }
              const orphanJustification =
                torIds.length === 0
                  ? (li.orphanJustification?.trim() || "No TOR clause reference provided.")
                  : null;

              await prisma.lineItem.create({
                data: {
                  engagementId,
                  tab: li.tab,
                  task: li.task,
                  description: li.description ?? "",
                  hours: li.hours,
                  conf: li.conf,
                  lowHrs: li.lowHrs,
                  highHrs: li.highHrs,
                  benchmarkRef: li.benchmarkRef ?? null,
                  integrationTier: li.integrationTier ?? null,
                  orphanJustification,
                  sourcePhaseId: null,
                  ...(torIds.length > 0
                    ? { torRefs: { connect: torIds.map((id) => ({ id })) } }
                    : {}),
                },
              });
            }
            // Diagnostic: count how many of the listed gap clauseRefs are now linked
            const listedGapRefs = new Set(gapItems.map((g) => normalizeClauseRef(g.clauseRef)));
            const sidecarCoveredRefs = new Set<string>();
            for (const li of sidecar.lineItems) {
              for (const ref of li.torClauseRefs ?? []) {
                const norm = normalizeClauseRef(ref);
                if (listedGapRefs.has(norm)) sidecarCoveredRefs.add(norm);
              }
            }
            const unresolvedGaps = [...listedGapRefs].filter((r) => !sidecarCoveredRefs.has(r));
            console.log(`[gap-fix] Re-synced ${sidecar.lineItems.length} LineItem rows. Gaps now covered in sidecar: ${sidecarCoveredRefs.size}/${listedGapRefs.size}. Unresolved: ${unresolvedGaps.join(", ") || "(none)"}`);
            if (unresolvedGaps.length > 0) {
              await job.updateProgress({
                type: "progress",
                tool: "Gap Fix Agent",
                message: `Warning: ${unresolvedGaps.length}/${listedGapRefs.size} gap clauseRefs still not linked in sidecar (${unresolvedGaps.slice(0, 3).join(", ")}${unresolvedGaps.length > 3 ? "..." : ""}). Score may not improve. Consider re-running.`,
              });
            }
          } else {
            console.warn(`[gap-fix] No sidecar found in patched estimate — LineItem rows not updated. Validation may not reflect changes.`);
          }
        } catch (err) {
          console.warn(`[gap-fix] LineItem re-sync failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
        }

        await job.updateProgress({
          type: "progress",
          tool: "Gap Fix Agent",
          message: "Re-running validation to compute updated accuracy score...",
        });

        // Now run validation — will query the fresh LineItem rows
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
        data: { status: "DONE", scoresAfter, completedAt: new Date() },
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
        data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
      });
      throw err;
    }
  },
  { concurrency: 2, connection: redisConnection }
);

export default worker;
