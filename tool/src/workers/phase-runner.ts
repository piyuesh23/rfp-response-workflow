import { Worker } from "bullmq";
import { runPhase, prepareWorkDir, syncFilesToStorage } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { extractMetadataForPhase } from "@/lib/ai/metadata-extractor";
import { prisma } from "@/lib/db";
import { notifyReviewNeeded, sendNotification } from "@/lib/notifications";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus, ArtefactType } from "@/generated/prisma/client";
import * as fs from "fs/promises";

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

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        status: PhaseStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Fetch engagement type for phase-specific behavior (e.g., conditional site audit)
      const engagementData = await prisma.engagement.findUnique({
        where: { id: engagementId },
        select: { engagementType: true, clientName: true },
      });

      const config = getPhaseConfig(
        String(phaseNumber),
        techStack,
        engagementId,
        engagementData?.engagementType
      );

      if (revisionFeedback) {
        config.userPrompt += `\n\nREVISION FEEDBACK FROM REVIEWER:\n${revisionFeedback}\n\nPlease address the above feedback in your output.`;
      }

      let finalContent: string | undefined;
      console.log(`[phase-runner] Starting phase ${phaseNumber} for engagement ${engagementId}`);
      for await (const event of runPhase(config)) {
        await job.updateProgress(event);
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
        "1A": ["estimates/optimistic-estimate.md"],
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
            contentMd: artefactContent,
            ...(metadata ? { metadata: JSON.parse(JSON.stringify(metadata)) } : {}),
          },
        });
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
