/**
 * Gap-fix worker (JSON-patch architecture).
 *
 * Replaces the previous Claude Code SDK agent loop (which rewrote the full
 * 55KB estimate markdown file on every turn, taking 2–5 min per turn). The
 * new path:
 *   1. Parse the current sidecar + TOR requirement list
 *   2. Ask Anthropic for a SMALL JSON patch in ONE call (no tool use, no loop)
 *   3. Apply the patch server-side: edit sidecar + append markdown rows
 *   4. Re-sync LineItem DB rows from the patched sidecar
 *   5. Re-run validateEstimateFull so the accuracy score updates
 *
 * Typical runtime: 10-30 seconds vs 30-60+ minutes for the agent loop.
 */
import { Worker } from "bullmq";
import { prepareWorkDir, syncFilesToStorage } from "@/lib/ai/agent";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { extractEstimateSidecar, normalizeClauseRef } from "@/lib/ai/sidecar-extractors";
import { generateGapFixPatch, applyGapFixPatch } from "@/lib/ai/gap-fix-patch";
import { prisma } from "@/lib/db";
import { redisConnection, GapFixJobData } from "@/lib/queue";
import { getLatestValidationReportsByPhase } from "@/lib/accuracy";
import * as fs from "fs/promises";
import * as path from "path";

const worker = new Worker<GapFixJobData>(
  "gap-fix",
  async (job) => {
    const { gapFixRunId, engagementId, techStack } = job.data;

    await prisma.gapFixRun.update({
      where: { id: gapFixRunId },
      data: { status: "RUNNING" },
    });

    try {
      await job.updateProgress({ type: "progress", tool: "Gap Fix", message: "Preparing work dir..." });
      const workDir = await prepareWorkDir(engagementId);

      // Probe candidate estimate files in priority order.
      // Phase 3 writes informed-estimate.md; Phase 1A writes optimistic-estimate.md.
      const ESTIMATE_CANDIDATES = [
        "estimates/informed-estimate.md",
        "estimates/optimistic-estimate.md",
        "estimates/revised-estimate.md",
      ];
      let estimatePath: string | null = null;
      for (const candidate of ESTIMATE_CANDIDATES) {
        try {
          await fs.access(path.join(workDir, candidate));
          estimatePath = path.join(workDir, candidate);
          break;
        } catch {
          // not found — try next
        }
      }
      if (!estimatePath) {
        throw new Error(
          `No estimate file found (tried: ${ESTIMATE_CANDIDATES.join(", ")}) — run Phase 1A or Phase 3 first.`
        );
      }

      const original = await fs.readFile(estimatePath, "utf-8");
      const sidecar = extractEstimateSidecar(original);
      if (!sidecar) throw new Error("Estimate file has no ESTIMATE-LINEITEMS-JSON sidecar. Regenerate via Phase 1A.");

      // Load gap data from the GapFixRun snapshot (written by POST endpoint)
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

      const det = gapsBefore.details ?? {};
      const gapItems = (det.coverage?.details?.gaps ?? []) as Array<{ clauseRef: string; title: string; domain?: string }>;
      const orphanItems = (det.coverage?.details?.orphans ?? []) as Array<{ tab: string; task: string }>;
      const confItems = (det.confFormula?.details?.violations ?? []) as Array<{ tab: string; task: string; field: string; expected: number; actual: number }>;
      const riskItems = (det.riskRegister?.details?.missing ?? []) as Array<{ task: string; conf: number }>;

      const engagement = await prisma.engagement.findUnique({
        where: { id: engagementId },
        select: { engagementType: true, techStackCustom: true },
      });

      // Collect valid TOR clauseRefs so the patch validator can reject hallucinated refs
      const torRequirements = await prisma.torRequirement.findMany({
        where: { engagementId },
        select: { clauseRef: true, normalizedClauseRef: true },
      });
      const validClauseRefs = new Set<string>();
      for (const r of torRequirements) {
        validClauseRefs.add(r.clauseRef);
        validClauseRefs.add(r.normalizedClauseRef);
      }

      await job.updateProgress({
        type: "progress",
        tool: "Gap Fix",
        message: `Requesting patch — ${gapItems.length} gaps, ${orphanItems.length} orphans, ${confItems.length} conf violations, ${riskItems.length} missing risk entries`,
      });

      // --- Single Anthropic call, no tool loop ---
      const patch = await generateGapFixPatch({
        sidecar: sidecar.lineItems,
        gaps: gapItems,
        orphans: orphanItems,
        confViolations: confItems,
        missingRiskItems: riskItems,
        techStack,
        techStackCustom: engagement?.techStackCustom ?? undefined,
        engagementType: engagement?.engagementType ?? undefined,
        validClauseRefs: [...validClauseRefs],
      });

      await job.updateProgress({
        type: "progress",
        tool: "Gap Fix",
        message: `Patch received — ${patch.linkClauses.length} link-clauses, ${patch.newLineItems.length} new items, ${patch.orphanFixes.length} orphan fixes, ${patch.confCorrections.length} conf corrections, ${patch.riskEntries.length} risk entries`,
      });

      // --- Apply patch deterministically server-side ---
      const { stats, warnings } = await applyGapFixPatch(estimatePath, patch, validClauseRefs);

      for (const w of warnings) {
        console.warn(`[gap-fix] ${w}`);
      }

      await job.updateProgress({
        type: "progress",
        tool: "Gap Fix",
        message: `Applied: +${stats.clauseLinksAdded} links, +${stats.newItemsAdded} items, ${stats.orphanFixesApplied} orphan fixes, ${stats.confCorrected} conf fixes, +${stats.riskRowsAppended} risks${warnings.length > 0 ? ` (${warnings.length} warnings)` : ""}`,
      });

      // --- Sync patched files back to object storage (non-fatal) ---
      try {
        await syncFilesToStorage(engagementId, workDir);
      } catch (err) {
        console.warn(`[gap-fix] Storage sync failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
      }

      // --- Re-sync LineItem DB rows from the patched sidecar ---
      const patchedEstimate = await fs.readFile(estimatePath, "utf-8");
      const patchedSidecar = extractEstimateSidecar(patchedEstimate);
      if (patchedSidecar && patchedSidecar.lineItems.length > 0) {
        const reqById = await prisma.torRequirement.findMany({
          where: { engagementId },
          select: { id: true, normalizedClauseRef: true },
        });
        const reqByNormalized = new Map<string, string>();
        for (const r of reqById) reqByNormalized.set(r.normalizedClauseRef, r.id);

        await prisma.lineItem.deleteMany({ where: { engagementId } });

        for (const li of patchedSidecar.lineItems) {
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
        console.log(`[gap-fix] Re-synced ${patchedSidecar.lineItems.length} LineItem rows for engagement ${engagementId}`);
      }

      // --- Re-run validation ---
      await job.updateProgress({
        type: "progress",
        tool: "Gap Fix",
        message: "Re-running validation to compute updated accuracy score...",
      });

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
