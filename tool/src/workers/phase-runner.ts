import { Worker } from "bullmq";
import { runPhase, prepareWorkDir, syncFilesToStorage, UsageStats } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { applyPromptOverrides } from "@/lib/ai/phases/prompt-overrides";
import { extractMetadataForPhase, extractRiskRegister, extractAssumptions } from "@/lib/ai/metadata-extractor";
import { validateEstimateFull } from "@/lib/ai/validate-estimate";
import { validateProposal } from "@/lib/ai/validate-proposal";
import {
  extractPhase1Sidecar,
  extractEstimateSidecar,
  normalizeClauseRef,
} from "@/lib/ai/sidecar-extractors";
import { prisma } from "@/lib/db";
import { notifyReviewNeeded, sendNotification } from "@/lib/notifications";
import { redisConnection, PhaseJobData } from "@/lib/queue";
import { PhaseStatus, ArtefactType } from "@/generated/prisma/client";
import {
  enqueueIndexArtefact,
  enqueueIndexStructuredRow,
  enqueueIndexTorFiles,
} from "@/lib/rag/enqueue";
import * as fs from "fs/promises";

// --------------------------------------------------------------------------
// RAG indexing helpers — thin wrappers that enqueue work to the rag-indexing
// queue so phase execution never blocks on OpenAI embedding latency.
// --------------------------------------------------------------------------

async function safeIndexArtefact(params: {
  engagementId: string;
  sourceId: string;
  content: string | null | undefined;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await enqueueIndexArtefact({
    engagementId: params.engagementId,
    sourceType: "ARTEFACT",
    sourceId: params.sourceId,
    content: params.content ?? "",
    metadata: params.metadata,
  });
}

async function safeIndexStructuredRow(params: {
  engagementId: string | null;
  sourceType: string;
  sourceId: string;
  summary: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await enqueueIndexStructuredRow({
    engagementId: params.engagementId ?? undefined,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    summary: params.summary,
    metadata: params.metadata,
  });
}

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
        select: {
          engagementType: true,
          clientName: true,
          techStackCustom: true,
          techStackIsCustom: true,
          projectDescription: true,
          legacyPlatform: true,
          legacyPlatformUrl: true,
        },
      });

      // Phase 5 hard-fail gate: proposal generation requires a pre-approved
      // solution-architecture.md (drafted at Phase 1 v0, revised by Phase 1A/3).
      // If it is missing we do NOT call the agent — we mark the phase FAILED and
      // write a PROPOSAL_BLOCKED.md artefact explaining the prerequisite.
      if (String(phaseNumber) === "5") {
        const solutionOnDisk = await fs
          .readFile(
            `/data/engagements/${engagementId}/claude-artefacts/solution-architecture.md`,
            "utf-8"
          )
          .then((c) => (c.trim().length > 100 ? c : null))
          .catch(() => null);

        let solutionInDb: { id: string } | null = null;
        if (!solutionOnDisk) {
          solutionInDb = await prisma.phaseArtefact.findFirst({
            where: {
              phase: { engagementId },
              OR: [
                { label: { contains: "solution-architecture", mode: "insensitive" } },
                { contentMd: { contains: "solution-architecture.md", mode: "insensitive" } },
              ],
            },
            select: { id: true },
          });
        }

        if (!solutionOnDisk && !solutionInDb) {
          const errorMessage =
            "Missing solution-architecture.md — required by Phase 5";
          console.error(
            `[phase-runner] Phase 5 blocked for engagement ${engagementId}: ${errorMessage}`
          );

          const blockedContent = [
            "# Proposal Blocked — Missing Prerequisite",
            "",
            "The Phase 5 proposal generator requires `claude-artefacts/solution-architecture.md` as input, but this file was not found in the engagement workspace or database.",
            "",
            "## Why this is required",
            "",
            "The solution architecture document is drafted in Phase 1 (v0) and revised by Phase 1A and Phase 3. It is the pre-approved technical foundation the proposal expands into client-ready narrative.",
            "",
            "## Remediation",
            "",
            "Re-run Phase 1 (or Phase 1A / Phase 3) to produce `claude-artefacts/solution-architecture.md`, then re-queue Phase 5.",
            "",
            `_Error:_ ${errorMessage}`,
            "",
          ].join("\n");

          await prisma.phaseArtefact.create({
            data: {
              phaseId,
              artefactType: ArtefactType.PROPOSAL,
              version: 1,
              label: "PROPOSAL_BLOCKED.md",
              contentMd: blockedContent,
              metadata: JSON.parse(
                JSON.stringify({ blocked: true, reason: errorMessage })
              ),
            },
          });

          await prisma.phase.update({
            where: { id: phaseId },
            data: {
              status: PhaseStatus.FAILED,
              completedAt: new Date(),
            },
          });

          try {
            await sendNotification({
              type: "phase_failed",
              engagementId,
              clientName: engagementData?.clientName ?? engagementId,
              phaseNumber,
              phaseLabel: "Phase 5",
              message: errorMessage,
            });
          } catch {
            // Notification failure must not break the worker
          }

          return;
        }
      }

      // Phase 1A: if the engagement has an OTHER tech stack, bootstrap ecosystem
      // notes + benchmarks via web-researched synthesis before building the prompt.
      let ecosystemNotes: string | undefined;
      let benchmarksMarkdown: string | undefined;
      if (
        String(phaseNumber) === "1A" &&
        engagementData?.techStackIsCustom &&
        engagementData.techStackCustom?.trim()
      ) {
        try {
          await job.updateProgress({
            type: "progress",
            tool: "Tech Stack Research",
            message: "Researching ecosystem for the user-provided tech stack…",
          });
          const { getOrRunTechStackResearch } = await import(
            "@/workers/tech-stack-research"
          );
          const research = await getOrRunTechStackResearch(engagementId);
          if (research) {
            ecosystemNotes = research.ecosystemSummary;
            benchmarksMarkdown = research.benchmarksMarkdown;
          }
        } catch (err) {
          console.warn(
            `[phase-runner] Tech-stack research failed for engagement ${engagementId}: ${
              err instanceof Error ? err.message : String(err)
            } — continuing Phase 1A without bootstrapped ecosystem notes.`
          );
        }
      }

      let config = getPhaseConfig(
        String(phaseNumber),
        techStack,
        engagementId,
        engagementData?.engagementType,
        {
          techStackCustom: engagementData?.techStackCustom ?? undefined,
          projectDescription: engagementData?.projectDescription ?? undefined,
          ecosystemNotes,
          benchmarksMarkdown,
        }
      );

      config = await applyPromptOverrides(config);

      if (revisionFeedback) {
        config.userPrompt += `\n\nREVISION FEEDBACK FROM REVIEWER:\n${revisionFeedback}\n\nPlease address the above feedback in your output.`;
      }

      let finalContent: string | undefined;
      console.log(`[phase-runner] Starting phase ${phaseNumber} for engagement ${engagementId}`);

      await job.updateProgress({
        type: "progress",
        tool: "Phase Runner",
        message: `Starting Phase ${phaseNumber} analysis...`,
      });

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

      await job.updateProgress({
        type: "progress",
        tool: "Phase Runner",
        message: "AI agent completed. Processing artefacts...",
      });

      // Enqueue raw TOR/addendum source documents for RAG chatbot retrieval.
      // Runs after Phase 1 (when syncTorFiles has populated workDir/tor/).
      // Idempotent: indexArtefact deletes prior chunks before inserting.
      if (String(phaseNumber) === "1") {
        const torWorkDir = `/data/engagements/${engagementId}`;
        await enqueueIndexTorFiles(engagementId, torWorkDir);
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
        "1": ["claude-artefacts/tor-assessment.md", "claude-artefacts/solution-architecture.md"],
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

        const createdArtefact = await prisma.phaseArtefact.create({
          data: {
            phaseId,
            artefactType,
            version: nextVersion,
            label: revisionFeedback ? "AI revision" : "AI generated",
            contentMd: artefactContent,
            ...(metadata ? { metadata: JSON.parse(JSON.stringify(metadata)) } : {}),
          },
        });

        await safeIndexArtefact({
          engagementId,
          sourceId: createdArtefact.id,
          content: artefactContent,
          metadata: {
            phaseNumber: phaseStr,
            artefactType,
            label: createdArtefact.label ?? null,
          },
        });
      }

      await job.updateProgress({
        type: "progress",
        tool: "Phase Runner",
        message: "Artefact saved. Extracting metadata...",
      });

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

            // RAG indexing for risk rows (non-fatal).
            try {
              const insertedRisks = await prisma.riskRegisterEntry.findMany({
                where: { engagementId },
                select: {
                  id: true,
                  task: true,
                  tab: true,
                  conf: true,
                  risk: true,
                  openQuestion: true,
                  recommendedAction: true,
                  hoursAtRisk: true,
                },
              });
              for (const r of insertedRisks) {
                await safeIndexStructuredRow({
                  engagementId,
                  sourceType: "RISK",
                  sourceId: r.id,
                  summary: `${r.task} (${r.tab}, Conf ${r.conf}): ${r.risk}. Open Q: ${r.openQuestion}. Action: ${r.recommendedAction}`,
                  metadata: { tab: r.tab, conf: r.conf, hoursAtRisk: r.hoursAtRisk },
                });
              }
            } catch (ragErr) {
              console.warn(
                `[rag-index] Risk batch index failed: ${ragErr instanceof Error ? ragErr.message : String(ragErr)}`
              );
            }
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

            // RAG indexing for assumption rows (non-fatal).
            try {
              const insertedAssumptions = await prisma.assumption.findMany({
                where: { engagementId },
                select: {
                  id: true,
                  text: true,
                  torReference: true,
                  impactIfWrong: true,
                  status: true,
                },
              });
              for (const a of insertedAssumptions) {
                await safeIndexStructuredRow({
                  engagementId,
                  sourceType: "ASSUMPTION",
                  sourceId: a.id,
                  summary: `${a.text} | Impact: ${a.impactIfWrong}`,
                  metadata: { torReference: a.torReference, status: a.status },
                });
              }
            } catch (ragErr) {
              console.warn(
                `[rag-index] Assumption batch index failed: ${ragErr instanceof Error ? ragErr.message : String(ragErr)}`
              );
            }
          }
        } catch (err) {
          console.warn(`[phase-runner] Phase ${phaseNumber} — failed to extract risks/assumptions: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Phase 1: ingest the TOR requirements sidecar into TorRequirement rows.
      if (phaseStr === "1" && artefactContent) {
        try {
          const existingCount = await prisma.torRequirement.count({
            where: { engagementId },
          });
          if (existingCount > 0) {
            console.log(
              `[phase-runner] Phase 1 — TorRequirement rows already exist (${existingCount}); skipping sidecar insert (idempotent).`
            );
          } else {
            const sidecar = extractPhase1Sidecar(artefactContent);
            if (!sidecar) {
              console.warn(
                `[phase-runner] Phase 1 — no valid PHASE1-REQUIREMENTS-JSON sidecar found; skipping TorRequirement insert.`
              );
            } else if (sidecar.requirements.length === 0) {
              console.warn(
                `[phase-runner] Phase 1 — sidecar parsed but contained 0 requirements.`
              );
            } else {
              const seen = new Set<string>();
              const rows = sidecar.requirements
                .map((r) => ({
                  engagementId,
                  clauseRef: r.clauseRef,
                  normalizedClauseRef: normalizeClauseRef(r.clauseRef),
                  title: r.title,
                  description: r.description ?? "",
                  domain: r.domain,
                  clarityRating: r.clarityRating,
                  sourcePhaseId: phaseId,
                }))
                .filter((row) => {
                  if (seen.has(row.normalizedClauseRef)) return false;
                  seen.add(row.normalizedClauseRef);
                  return true;
                });
              if (rows.length > 0) {
                await prisma.torRequirement.createMany({ data: rows });
                console.log(
                  `[phase-runner] Phase 1 — inserted ${rows.length} TorRequirement rows for engagement ${engagementId}.`
                );

                // RAG indexing for TorRequirement rows (non-fatal).
                try {
                  const insertedReqs = await prisma.torRequirement.findMany({
                    where: {
                      engagementId,
                      normalizedClauseRef: { in: rows.map((r) => r.normalizedClauseRef) },
                    },
                    select: {
                      id: true,
                      clauseRef: true,
                      title: true,
                      description: true,
                      domain: true,
                      clarityRating: true,
                    },
                  });
                  for (const r of insertedReqs) {
                    await safeIndexStructuredRow({
                      engagementId,
                      sourceType: "REQUIREMENT",
                      sourceId: r.id,
                      summary: `${r.clauseRef}: ${r.title} — ${r.description} (${r.domain}, ${r.clarityRating})`,
                      metadata: {
                        clauseRef: r.clauseRef,
                        domain: r.domain,
                        clarityRating: r.clarityRating,
                      },
                    });
                  }
                } catch (ragErr) {
                  console.warn(
                    `[rag-index] TorRequirement batch index failed: ${ragErr instanceof Error ? ragErr.message : String(ragErr)}`
                  );
                }
              }
            }
          }
        } catch (err) {
          console.warn(
            `[phase-runner] Phase 1 — TorRequirement sidecar ingest failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Phase 1A / Phase 3: ingest the estimate line-item sidecar and link to TorRequirements.
      if ((phaseStr === "1A" || phaseStr === "3") && artefactContent) {
        try {
          const sidecar = extractEstimateSidecar(artefactContent);
          if (!sidecar) {
            console.warn(
              `[phase-runner] Phase ${phaseStr} — no valid ESTIMATE-LINEITEMS-JSON sidecar; skipping LineItem insert.`
            );
          } else if (sidecar.lineItems.length === 0) {
            console.warn(
              `[phase-runner] Phase ${phaseStr} — sidecar parsed but contained 0 line items.`
            );
          } else {
            // Build a lookup of existing TorRequirement rows for this engagement keyed by normalizedClauseRef.
            const existingRequirements = await prisma.torRequirement.findMany({
              where: { engagementId },
              select: { id: true, normalizedClauseRef: true },
            });
            const reqByNormalized = new Map<string, string>();
            for (const r of existingRequirements) {
              reqByNormalized.set(r.normalizedClauseRef, r.id);
            }

            // Replace existing line items for this engagement to keep insert idempotent per phase run.
            await prisma.lineItem.deleteMany({ where: { engagementId } });

            let inserted = 0;
            let linked = 0;
            let unresolved = 0;
            for (const li of sidecar.lineItems) {
              const torIds: string[] = [];
              const missing: string[] = [];
              for (const ref of li.torClauseRefs) {
                const norm = normalizeClauseRef(ref);
                const id = reqByNormalized.get(norm);
                if (id) torIds.push(id);
                else missing.push(ref);
              }
              if (missing.length > 0) {
                unresolved += missing.length;
                console.warn(
                  `[phase-runner] Phase ${phaseStr} — LineItem "${li.task}" references unknown clauseRefs: ${missing.join(", ")}`
                );
              }

              const orphanJustification =
                torIds.length === 0
                  ? li.orphanJustification && li.orphanJustification.trim().length > 0
                    ? li.orphanJustification
                    : "No TOR clause reference provided."
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
                  sourcePhaseId: phaseId,
                  ...(torIds.length > 0
                    ? { torRefs: { connect: torIds.map((id) => ({ id })) } }
                    : {}),
                },
              });
              inserted += 1;
              linked += torIds.length;
            }
            console.log(
              `[phase-runner] Phase ${phaseStr} — inserted ${inserted} LineItem rows (${linked} TOR links, ${unresolved} unresolved clauseRefs).`
            );

            // RAG indexing for LineItem rows (non-fatal).
            try {
              const insertedLineItems = await prisma.lineItem.findMany({
                where: { engagementId },
                select: {
                  id: true,
                  tab: true,
                  task: true,
                  description: true,
                  hours: true,
                  conf: true,
                  integrationTier: true,
                  torRefs: { select: { clauseRef: true } },
                },
              });
              for (const li of insertedLineItems) {
                const refs = li.torRefs.map((t) => t.clauseRef).join(",");
                await safeIndexStructuredRow({
                  engagementId,
                  sourceType: "LINE_ITEM",
                  sourceId: li.id,
                  summary: `${li.tab}/${li.task}: ${li.description} (${li.hours}h, Conf ${li.conf}, TOR refs: ${refs})`,
                  metadata: {
                    tab: li.tab,
                    hours: li.hours,
                    conf: li.conf,
                    integrationTier: li.integrationTier,
                  },
                });
              }
            } catch (ragErr) {
              console.warn(
                `[rag-index] LineItem batch index failed: ${ragErr instanceof Error ? ragErr.message : String(ragErr)}`
              );
            }
          }
        } catch (err) {
          console.warn(
            `[phase-runner] Phase ${phaseStr} — LineItem sidecar ingest failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      await job.updateProgress({
        type: "progress",
        tool: "Phase Runner",
        message: "Running validation checks...",
      });

      // For estimate phases: run full validation (benchmark + structural) and store report
      if (["1A", "3"].includes(phaseStr) && artefactContent) {
        try {
          const fullReport = await validateEstimateFull(
            artefactContent,
            techStack,
            engagementId,
            phaseStr
          );
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

      // For Phase 1 / 1A / 3: also persist solution-architecture.md as a separate artefact.
      // Phase 1 emits a v0 draft (HAS_RESPONSE + NO_RESPONSE paths), Phase 1A/3 revise it.
      if (phaseStr === "1" || phaseStr === "1A" || phaseStr === "3") {
        try {
          const solutionPath = `${workDir}/claude-artefacts/solution-architecture.md`;
          const solutionMd = await fs.readFile(solutionPath, "utf-8");
          if (solutionMd.trim().length > 100) {
            const latestSolution = await prisma.phaseArtefact.findFirst({
              where: { phaseId, artefactType: ArtefactType.RESEARCH },
              orderBy: { version: "desc" },
              select: { version: true },
            });
            const nextSolutionVersion = (latestSolution?.version ?? 0) + 1;
            const solutionArtefact = await prisma.phaseArtefact.create({
              data: {
                phaseId,
                artefactType: ArtefactType.RESEARCH,
                version: nextSolutionVersion,
                label: "solution-architecture.md",
                contentMd: solutionMd,
              },
            });
            console.log(`[phase-runner] Phase ${phaseNumber} — persisted solution-architecture.md as artefact (v${nextSolutionVersion})`);

            await safeIndexArtefact({
              engagementId,
              sourceId: solutionArtefact.id,
              content: solutionMd,
              metadata: {
                phaseNumber: phaseStr,
                artefactType: ArtefactType.RESEARCH,
                label: "solution-architecture.md",
              },
            });
          }
        } catch {
          // Solution doc may not exist (e.g., discovery engagements at Phase 1A) — non-fatal here.
          // The hard-fail gate for Phase 5 lives below.
        }
      }

      // For Phase 1: also persist questions.md as a separate QUESTIONS artefact
      // This ensures questions are in the DB regardless of S3 sync success
      if (String(phaseNumber) === "1") {
        try {
          const questionsPath = `/data/engagements/${engagementId}/initial_questions/questions.md`;
          const questionsMd = await fs.readFile(questionsPath, "utf-8");
          if (questionsMd.trim()) {
            const questionsArtefact = await prisma.phaseArtefact.create({
              data: {
                phaseId,
                artefactType: ArtefactType.QUESTIONS,
                version: 1,
                contentMd: questionsMd,
              },
            });

            await safeIndexArtefact({
              engagementId,
              sourceId: questionsArtefact.id,
              content: questionsMd,
              metadata: {
                phaseNumber: "1",
                artefactType: ArtefactType.QUESTIONS,
                label: "questions.md",
              },
            });
          }
        } catch {
          // questions.md may not exist — non-fatal
        }
      }

      // Phase 1A: for MIGRATION / REDESIGN engagements, emit a Legacy Platform
      // Access Checklist as a secondary artefact. Runs inside the same work-dir
      // so the file gets synced to storage in the step below.
      if (
        String(phaseNumber) === "1A" &&
        (engagementData?.engagementType === "MIGRATION" ||
          engagementData?.engagementType === "REDESIGN")
      ) {
        try {
          await job.updateProgress({
            type: "progress",
            tool: "Legacy Access Checklist",
            message: "Drafting legacy platform access checklist…",
          });
          const { getPhase1ALegacyChecklistConfig } = await import(
            "@/lib/ai/phases/phase1a-legacy-checklist"
          );
          const checklistConfig = getPhase1ALegacyChecklistConfig({
            engagementId,
            techStack,
            engagementType: engagementData?.engagementType,
            legacyPlatform: engagementData?.legacyPlatform ?? undefined,
            legacyPlatformUrl: engagementData?.legacyPlatformUrl ?? undefined,
            techStackCustom: engagementData?.techStackCustom ?? undefined,
          });
          for await (const ev of runPhase(checklistConfig)) {
            await job.updateProgress(ev);
            if (ev.type === "error") {
              console.warn(
                `[phase-runner] Legacy-checklist agent error: ${ev.message}`
              );
            }
          }
          const checklistPath = `/data/engagements/${engagementId}/claude-artefacts/legacy-access-checklist.md`;
          const checklistMd = await fs.readFile(checklistPath, "utf-8").catch(() => "");
          if (checklistMd.trim().length > 100) {
            const checklistArtefact = await prisma.phaseArtefact.create({
              data: {
                phaseId,
                artefactType: ArtefactType.LEGACY_ACCESS_CHECKLIST,
                version: 1,
                label: "legacy-access-checklist.md",
                contentMd: checklistMd,
              },
            });
            await safeIndexArtefact({
              engagementId,
              sourceId: checklistArtefact.id,
              content: checklistMd,
              metadata: {
                phaseNumber: "1A",
                artefactType: ArtefactType.LEGACY_ACCESS_CHECKLIST,
                label: "legacy-access-checklist.md",
              },
            });
          }
        } catch (err) {
          console.warn(
            `[phase-runner] Legacy-checklist step failed for engagement ${engagementId}: ${
              err instanceof Error ? err.message : String(err)
            } — non-fatal, continuing.`
          );
        }
      }

      await job.updateProgress({
        type: "progress",
        tool: "Phase Runner",
        message: "Syncing files to storage...",
      });

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
