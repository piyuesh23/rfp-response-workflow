import { Worker } from "bullmq";
import { runPhase } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { prisma } from "@/lib/db";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus } from "@/generated/prisma/client";

const worker = new Worker<PhaseJobData>(
  "phase-execution",
  async (job) => {
    const { phaseId, engagementId, phaseNumber, techStack } = job.data;

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
    } catch (err) {
      await prisma.phase.update({
        where: { id: phaseId },
        data: {
          status: PhaseStatus.FAILED,
        },
      });
      throw err;
    }
  },
  {
    concurrency: 3,
    connection: redisConnection,
  }
);

export default worker;
