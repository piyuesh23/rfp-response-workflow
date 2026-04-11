import { Worker } from "bullmq";
import { runPhase, prepareWorkDir, syncFilesToStorage, UsageStats } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { applyPromptOverrides } from "@/lib/ai/phases/prompt-overrides";
import { extractMetadataForPhase, extractRiskRegister, extractAssumptions } from "@/lib/ai/metadata-extractor";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { validateProposal } from "@/lib/ai/validate-proposal";
import { prisma } from "@/lib/db";
import { notifyReviewNeeded, sendNotification } from "@/lib/notifications";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus, ArtefactType } from "@/generated/prisma/client";
import * as fs from "fs/promises";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
};

// Map phase numbers to their primary artefact type
const PHASE_ARTEFACT_TYPE: Record<string, ArtefactType> = {
  "0": ArtefactType.RESEARCH,
  "1": ArtefactType.TOR_ASSESSMENT,
  "1A": ArtefactType.ESTIMATE,
  "2": ArtefactType.RESPONSE_ANALYSIS,
  "3": ArtefactType.ESTIMATE,
  "3R": ArtefactType.GAP_ANALYSIS,
  "5": ArtefactType.PROPOSAL,
};

const worker = new Worker<PhaseJobData>(
  "phase-execution",
  async (job) => {
    const { phaseId, engagementId, phaseNumber, techStack, revisionFeedback } = job.data;

    const phaseStartedAt = new Date();
    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        status: PhaseStatus.RUNNING,
        startedAt: phaseStartedAt,
      },
    });

    let usageStats: UsageStats | undefined;

    try {
      // Fetch engagement type for phase-specific behavior (e.g., conditional site audit)
      const engagementData = await prisma.engagement.findUnique({
        where: { id: engagementId },
        select: { engagementType: true, clientName: true },
      });

      let config = getPhaseConfig(
        String(phaseNumber),
        techStack,
        engagementId,
        engagementData?.engagementType
      );

      config = await applyPromptOverrides(config);

      if (revisionFeedback) {
        config.userPrompt += `\n\nREVISION FEEDBACK FROM REVIEWER:\n${revisionFeedback}\n\nPlease address the above feedback in your output.`;
      }

      let finalContent: string | undefined;
      console.log(`[phase-runner] Starting phase ${phaseNumber} for engagement ${engagementId}`);
      for await (const event of runPhase(config)) {
        await job.updateProgress(event);
        if (event.usageStats) usageStats = event.usageStats;
        if (event.type === "complete" && event.content) {
          finalContent = event.content;
          console.log(`[phase-runner] Phase ${phaseNumber} agent complete — finalContent: ${event.content.length} chars`);
        }
        if (event.type === "error") {
          console.error(`[phase-runner] Phase ${phaseNumber} agent error: ${event.message}`);
        }
      }

      // Persist artefact if the phase produced content
      // The agentic loop's finalContent is Claude's summary text.
      // The actual artefact content is written to files via tool calls.
      // We prefer the file content over the summary for DB storage.
      const phaseStr = String(phaseNumber);
      const workDir = `/data/engagements/${engagementId}`;

      // Map phases to their primary output file paths (in priority order)
      const PHASE_OUTPUT_FILES: Record<string, string[]> = {
        "0": ["research/customer-research.md"],
        "1": ["claude-artefacts/tor-assessment.md"],
        "1A": ["estimates/optimistic-estimate.md", "claude-artefacts/solution-architecture.md"],
        "2": ["claude-artefacts/response-analysis.md"],
        "3": ["estimates/revised-estimate.md", "estimates/optimistic-estimate.md"],
        "3R": ["claude-artefacts/gap-analysis.md"],
        "5": ["claude-artefacts/technical-proposal.md"],
      };

      // Try to read the actual file content; fall back to finalContent (summary)
      let artefactContent = finalContent;
      const outputFiles = PHASE_OUTPUT_FILES[phaseStr] ?? [];
      for (const relPath of outputFiles) {
        try {
          const fileMd = await fs.readFile(`${workDir}/${relPath}`, "utf-8");
          if (fileMd.trim().length > 100) {
            console.log(`[phase-runner] Phase ${phaseNumber} — using file ${relPath} (${fileMd.length} chars) as artefact content`);
            artefactContent = fileMd;
            break;
          }
        } catch {
          console.log(`[phase-runner] Phase ${phaseNumber} — file ${relPath} not found on disk`);
        }
      }
      if (!artefactContent) {
        console.warn(`[phase-runner] Phase ${phaseNumber} — no file content and no finalContent`);
      }

      if (artefactContent) {
        const artefactType = PHASE_ARTEFACT_TYPE[phaseStr] ?? ArtefactType.RESEARCH;

        // Determine next version number
        const latestArtefact = await prisma.phaseArtefact.findFirst({
          where: { phaseId, artefactType },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const nextVersion = (latestArtefact?.version ?? 0) + 1;

        // Extract structured metadata from the actual content (not summary)
        const metadata = extractMetadataForPhase(phaseStr, artefactContent);

        await prisma.phaseArtefact.create({
          data: {
            phaseId,
            artefactType,
            version: nextVersion,
            label: revisionFeedback ? "AI revision" : "AI generated",
            contentMd: artefactContent,
            ...(metadata ? { metadata: JSON.parse(JSON.stringify(metadata)) } : {}),
          },
        });
      }

      // For estimate phases: extract and persist Risk Register + Assumption entries
      if (["1A", "3", "3R"].includes(phaseStr) && artefactContent) {
        try {
          const risks = extractRiskRegister(artefactContent);
          if (risks.length > 0) {
            await prisma.riskRegisterEntry.deleteMany({ where: { engagementId } });
            await prisma.riskRegisterEntry.createMany({
              data: risks.map((r) => ({ ...r, engagementId })),
            });
            console.log(`[phase-runner] Phase ${phaseNumber} — created ${risks.length} risk register entries`);
          }

          const assumptions = extractAssumptions(artefactContent);
          if (assumptions.length > 0) {
            await prisma.assumption.deleteMany({ where: { engagementId } });
            await prisma.assumption.createMany({
              data: assumptions.map((a) => ({
                text: a.text,
                torReference: a.torReference,
                impactIfWrong: a.impactIfWrong,
                engagementId,
                sourcePhaseId: phaseId,
                status: "ACTIVE",
              })),
            });
            console.log(`[phase-runner] Phase ${phaseNumber} — created ${assumptions.length} assumption entries`);
          }
        } catch (err) {
          console.warn(`[phase-runner] Phase ${phaseNumber} — failed to extract risks/assumptions: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // For estimate phases: run full validation (benchmark + structural) and store report
      if (["1A", "3"].includes(phaseStr) && artefactContent) {
        try {
          const fullReport = await validateEstimateFull(artefactContent, techStack);
          // Update the artefact metadata with validation results
          const latestArtefact = await prisma.phaseArtefact.findFirst({
            where: { phaseId },
            orderBy: { version: "desc" },
            select: { id: true, metadata: true },
          });
          if (latestArtefact) {
            const existingMeta = (latestArtefact.metadata as Record<string, unknown>) ?? {};
            await prisma.phaseArtefact.update({
              where: { id: latestArtefact.id },
              data: {
                metadata: JSON.parse(JSON.stringify({
                  ...existingMeta,
                  benchmarkValidation: {
                    passCount: fullReport.benchmark.passCount,
                    warnCount: fullReport.benchmark.warnCount,
                    failCount: fullReport.benchmark.failCount,
                    noBenchmarkCount: fullReport.benchmark.noBenchmarkCount,
                    totalItems: fullReport.benchmark.items.length,
                  },
                  fullValidation: {
                    overallStatus: fullReport.overallStatus,
                    structural: fullReport.structural,
                  },
                })),
              },
            });
            console.log(
              `[phase-runner] Phase ${phaseNumber} — validation: ${fullReport.overallStatus} (benchmark: ${fullReport.benchmark.passCount}P/${fullReport.benchmark.warnCount}W/${fullReport.benchmark.failCount}F, structural: ${fullReport.structural.filter(s => s.status === "PASS").length}P/${fullReport.structural.filter(s => s.status === "WARN").length}W/${fullReport.structural.filter(s => s.status === "FAIL").length}F)`
            );
          }
        } catch (err) {
          console.warn(
            `[phase-runner] Phase ${phaseNumber} — validation failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // For proposal phase: run proposal validation and store report
      if (phaseStr === "5" && artefactContent) {
        try {
          const proposalReport = await validateProposal(artefactContent, engagementId);
          const latestArtefact = await prisma.phaseArtefact.findFirst({
            where: { phaseId },
            orderBy: { version: "desc" },
            select: { id: true, metadata: true },
          });
          if (latestArtefact) {
            const existingMeta = (latestArtefact.metadata as Record<string, unknown>) ?? {};
            await prisma.phaseArtefact.update({
              where: { id: latestArtefact.id },
              data: {
                metadata: JSON.parse(JSON.stringify({
                  ...existingMeta,
                  proposalValidation: {
                    overallStatus: proposalReport.overallStatus,
                    items: proposalReport.items,
                  },
                })),
              },
            });
            console.log(
              `[phase-runner] Phase ${phaseNumber} — proposal validation: ${proposalReport.overallStatus} (${proposalReport.items.filter(i => i.status === "PASS").length}P/${proposalReport.items.filter(i => i.status === "WARN").length}W/${proposalReport.items.filter(i => i.status === "FAIL").length}F)`
            );
          }
        } catch (err) {
          console.warn(
            `[phase-runner] Phase ${phaseNumber} — proposal validation failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // For Phase 1A: also persist solution-architecture.md as a separate artefact
      if (phaseStr === "1A") {
        try {
          const solutionPath = `${workDir}/claude-artefacts/solution-architecture.md`;
          const solutionMd = await fs.readFile(solutionPath, "utf-8");
          if (solutionMd.trim().length > 100) {
            await prisma.phaseArtefact.create({
              data: {
                phaseId,
                artefactType: ArtefactType.RESEARCH,
                version: 1,
                contentMd: solutionMd,
              },
            });
            console.log(`[phase-runner] Phase ${phaseNumber} — persisted solution-architecture.md as artefact`);
          }
        } catch {
          // Solution doc may not exist (e.g., discovery engagements) — non-fatal
        }
      }

      // For Phase 1: also persist questions.md as a separate QUESTIONS artefact
      // This ensures questions are in the DB regardless of S3 sync success
      if (String(phaseNumber) === "1") {
        try {
          const questionsPath = `/data/engagements/${engagementId}/initial_questions/questions.md`;
          const questionsMd = await fs.readFile(questionsPath, "utf-8");
          if (questionsMd.trim()) {
            await prisma.phaseArtefact.create({
              data: {
                phaseId,
                artefactType: ArtefactType.QUESTIONS,
                version: 1,
                contentMd: questionsMd,
              },
            });
          }
        } catch {
          // questions.md may not exist — non-fatal
        }
      }

      // Sync all generated files back to MinIO/S3
      try {
        const workDir = `/data/engagements/${engagementId}`;
        const uploaded = await syncFilesToStorage(engagementId, workDir);
        if (uploaded > 0) {
          await job.updateProgress({
            type: "progress",
            message: `Synced ${uploaded} file(s) to storage`,
          });
        }
      } catch {
        // Storage sync failure is non-fatal
      }

      // Check if any artefact was produced — fail if not
      const artefactCount = await prisma.phaseArtefact.count({
        where: { phaseId },
      });
      if (artefactCount === 0 && !artefactContent) {
        console.error(`[phase-runner] Phase ${phaseNumber} produced no artefact content — marking as FAILED`);
        await prisma.phase.update({
          where: { id: phaseId },
          data: { status: PhaseStatus.FAILED },
        });
        return;
      }

      console.log(`[phase-runner] Phase ${phaseNumber} complete — ${artefactCount} artefact(s), moving to REVIEW`);

      // Record PhaseExecution for analytics
      try {
        const engagementForUser = await prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { createdById: true },
        });

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - phaseStartedAt.getTime();

        let estimatedCostUsd: number | undefined;
        if (usageStats?.modelId) {
          const pricing = MODEL_PRICING[usageStats.modelId];
          if (pricing) {
            estimatedCostUsd =
              (usageStats.inputTokens / 1_000_000) * pricing.input +
              (usageStats.outputTokens / 1_000_000) * pricing.output;
          }
        }

        await prisma.phaseExecution.create({
          data: {
            phaseId,
            engagementId,
            userId: engagementForUser?.createdById ?? "unknown",
            phaseNumber: String(phaseNumber),
            startedAt: phaseStartedAt,
            completedAt,
            durationMs,
            inputTokens: usageStats?.inputTokens ?? 0,
            outputTokens: usageStats?.outputTokens ?? 0,
            totalTokens: usageStats?.totalTokens ?? 0,
            modelId: usageStats?.modelId ?? null,
            estimatedCostUsd: estimatedCostUsd ?? null,
            apiCallCount: usageStats?.apiCallCount ?? 0,
            turnCount: usageStats?.turnCount ?? 0,
            status: "COMPLETED",
          },
        });
      } catch (analyticsErr) {
        // Analytics recording failure must not break the worker
        console.warn(`[phase-runner] Failed to record PhaseExecution: ${analyticsErr instanceof Error ? analyticsErr.message : String(analyticsErr)}`);
      }

      await prisma.phase.update({
        where: { id: phaseId },
        data: {
          status: PhaseStatus.REVIEW,
          completedAt: new Date(),
        },
      });

      try {
        await notifyReviewNeeded(engagementId, phaseNumber);
      } catch {
        // Notification failure must not break the worker
      }
    } catch (err) {
      await prisma.phase.update({
        where: { id: phaseId },
        data: {
          status: PhaseStatus.FAILED,
        },
      });

      // Record PhaseExecution for failed phases
      try {
        const engagementForUser = await prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { createdById: true },
        });

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - phaseStartedAt.getTime();

        let estimatedCostUsd: number | undefined;
        if (usageStats?.modelId) {
          const pricing = MODEL_PRICING[usageStats.modelId];
          if (pricing) {
            estimatedCostUsd =
              (usageStats.inputTokens / 1_000_000) * pricing.input +
              (usageStats.outputTokens / 1_000_000) * pricing.output;
          }
        }

        await prisma.phaseExecution.create({
          data: {
            phaseId,
            engagementId,
            userId: engagementForUser?.createdById ?? "unknown",
            phaseNumber: String(phaseNumber),
            startedAt: phaseStartedAt,
            completedAt,
            durationMs,
            inputTokens: usageStats?.inputTokens ?? 0,
            outputTokens: usageStats?.outputTokens ?? 0,
            totalTokens: usageStats?.totalTokens ?? 0,
            modelId: usageStats?.modelId ?? null,
            estimatedCostUsd: estimatedCostUsd ?? null,
            apiCallCount: usageStats?.apiCallCount ?? 0,
            turnCount: usageStats?.turnCount ?? 0,
            status: "FAILED",
          },
        });
      } catch (analyticsErr) {
        console.warn(`[phase-runner] Failed to record PhaseExecution on failure: ${analyticsErr instanceof Error ? analyticsErr.message : String(analyticsErr)}`);
      }

      try {
        const engagement = await prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { clientName: true },
        });
        await sendNotification({
          type: "phase_failed",
          engagementId,
          clientName: engagement?.clientName ?? engagementId,
          phaseNumber,
          phaseLabel: `Phase ${phaseNumber}`,
          message: `Phase ${phaseNumber} failed with an error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } catch {
        // Notification failure must not break the worker
      }

      throw err;
    }
  },
  {
    concurrency: 3,
    connection: redisConnection,
  }
);

export default worker;
