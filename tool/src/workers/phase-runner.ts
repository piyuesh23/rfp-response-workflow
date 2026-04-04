import { Worker } from "bullmq";
import { runPhase } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { prisma } from "@/lib/db";
import { notifyReviewNeeded, sendNotification } from "@/lib/notifications";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus } from "@/generated/prisma/client";

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

      for await (const event of runPhase(config)) {
        await job.updateProgress(event);
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
