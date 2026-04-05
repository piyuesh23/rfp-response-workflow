import { Worker } from "bullmq";
import { runPhase, prepareWorkDir, syncFilesToStorage } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { extractMetadataForPhase } from "@/lib/ai/metadata-extractor";
import { parseEstimateMarkdown, estimateDataToExcelTabs } from "@/lib/estimate-parser";
import { generateEstimateXlsx } from "@/lib/excel-export";
import { uploadFile } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { notifyReviewNeeded, sendNotification } from "@/lib/notifications";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus, ArtefactType } from "@/generated/prisma/client";
import * as fs from "fs/promises";

// Phases that produce estimate content and should auto-generate Excel
const ESTIMATE_PHASES = new Set(["1A", "3"]);

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

        // Extract structured metadata from the markdown content
        const metadata = extractMetadataForPhase(String(phaseNumber), finalContent);

        await prisma.phaseArtefact.create({
          data: {
            phaseId,
            artefactType,
            version: nextVersion,
            contentMd: finalContent,
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

      // Auto-generate Excel for estimation phases and upload to MinIO
      if (finalContent && ESTIMATE_PHASES.has(String(phaseNumber))) {
        try {
          const clientName = engagementData?.clientName ?? "engagement";
          const estimateData = parseEstimateMarkdown(finalContent);
          const tabs = estimateDataToExcelTabs(estimateData);
          const excelBuffer = await generateEstimateXlsx(tabs, clientName);
          const safeClientName = clientName.replace(/[^a-zA-Z0-9-_]/g, "-");
          const s3Key = `engagements/${engagementId}/estimates/${safeClientName}-estimate.xlsx`;
          await uploadFile(
            s3Key,
            excelBuffer,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );

          // Save a reference artefact for the Excel file
          await prisma.phaseArtefact.create({
            data: {
              phaseId,
              artefactType: ArtefactType.ESTIMATE_STATE,
              version: 1,
              fileUrl: s3Key,
            },
          });

          await job.updateProgress({
            type: "progress",
            message: `Generated Excel estimate: ${safeClientName}-estimate.xlsx`,
          });
        } catch {
          // Excel generation failure is non-fatal
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
