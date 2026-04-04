import { Worker } from "bullmq";
import { runPhase } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { prisma } from "@/lib/db";
import { notifyReviewNeeded, sendNotification } from "@/lib/notifications";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus, ArtefactType } from "@/generated/prisma/client";

// Map phase numbers to their primary artefact type
const PHASE_ARTEFACT_TYPE: Record<string, ArtefactType> = {
  "0": ArtefactType.RESEARCH,
  "1": ArtefactType.TOR_ASSESSMENT,
  "1A": ArtefactType.ESTIMATE,
  "2": ArtefactType.RESPONSE_ANALYSIS,
  "3": ArtefactType.REVIEW,
  "4": ArtefactType.GAP_ANALYSIS,
  "5": ArtefactType.RESEARCH,
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
      const config = getPhaseConfig(
        String(phaseNumber),
        techStack,
        engagementId
      );

      if (revisionFeedback) {
        config.userPrompt += `\n\nREVISION FEEDBACK FROM REVIEWER:\n${revisionFeedback}\n\nPlease address the above feedback in your output.`;
      }

      let finalContent: string | undefined;
      for await (const event of runPhase(config)) {
        await job.updateProgress(event);
        if (event.type === "complete" && event.content) {
          finalContent = event.content;
        }
      }

      // Persist artefact if the phase produced content
      if (finalContent) {
        const artefactType = PHASE_ARTEFACT_TYPE[String(phaseNumber)] ?? ArtefactType.RESEARCH;

        // Determine next version number
        const latestArtefact = await prisma.phaseArtefact.findFirst({
          where: { phaseId, artefactType },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const nextVersion = (latestArtefact?.version ?? 0) + 1;

        await prisma.phaseArtefact.create({
          data: {
            phaseId,
            artefactType,
            version: nextVersion,
            contentMd: finalContent,
          },
        });
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
