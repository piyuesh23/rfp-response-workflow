/**
 * Post-generation proposal validation.
 * Checks that a technical proposal carries forward assumptions, risks,
 * integrations, and architecture decisions from the estimate phase.
 * Pure TypeScript — no AI calls.
 */

import { prisma } from "@/lib/db";
import { runIntegrationTierValidation } from "./validators/integration-tier";
import { runProposalObjectiveValidation } from "./validators/proposal-objective";
import type { ValidatorResult } from "./validators/types";

export interface ProposalValidationItem {
  category: "ASSUMPTION_COVERAGE" | "RISK_COVERAGE" | "INTEGRATION_COVERAGE" | "ARCHITECTURE_REFERENCE";
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  expected?: number;
  found?: number;
}

export interface ProposalValidationReport {
  items: ProposalValidationItem[];
  overallStatus: "PASS" | "WARN" | "FAIL";
  structured?: StructuredProposalSummary;
}

/**
 * Structured validators run against DB-backed TorRequirement rows to check
 * proposal-to-TOR alignment. Populated when engagementId resolves requirements.
 */
export interface StructuredProposalSummary {
  integrationTier: ValidatorResult;
  proposalObjective: ValidatorResult;
  accuracyScore: number;
  validationReportId?: string;
}

/**
 * Count assumption-like entries in proposal content.
 * Looks for bullet points or table rows in Assumptions/Scope sections.
 */
function countProposalAssumptions(proposalMd: string): number {
  // Find section 7 or "Assumptions" section
  const sectionMatch = proposalMd.match(
    /^#{1,3}\s+(?:7[\s.]|.*Assumption.*|.*Scope\s+Boundar)/im
  );
  if (!sectionMatch) return 0;

  const startIdx = proposalMd.indexOf(sectionMatch[0]);
  // Find next top-level section (## or ### with number)
  const remainder = proposalMd.slice(startIdx + sectionMatch[0].length);
  const nextSection = remainder.match(/^#{1,3}\s+(?:\d+[\s.]|Why\s|Investment|Next\s+Step)/im);
  const sectionContent = nextSection
    ? remainder.slice(0, remainder.indexOf(nextSection[0]))
    : remainder;

  // Count bullet items and table rows (excluding headers/separators)
  const bullets = (sectionContent.match(/^[\s]*[-*]\s+.{10,}/gm) ?? []).length;
  const tableRows = (sectionContent.match(/^\|[^-|][^|]*\|/gm) ?? []).length;

  return bullets + tableRows;
}

/**
 * Check if proposal has a risk section with entries.
 */
function countProposalRisks(proposalMd: string): number {
  // Look for Risk Register, Risk Summary, or risk-related sections
  const riskMatch = proposalMd.match(
    /^#{1,4}\s+(?:.*Risk.*(?:Register|Summary|Assessment))/im
  );
  if (!riskMatch) return 0;

  const startIdx = proposalMd.indexOf(riskMatch[0]);
  const remainder = proposalMd.slice(startIdx + riskMatch[0].length);
  const nextSection = remainder.match(/^#{1,3}\s+(?:\d+[\s.]|Why\s|Next\s+Step)/im);
  const sectionContent = nextSection
    ? remainder.slice(0, remainder.indexOf(nextSection[0]))
    : remainder.slice(0, 3000);

  // Count table rows (excluding header + separator)
  const tableRows = (sectionContent.match(/^\|[^-|][^|]*\|/gm) ?? []).length;
  const bullets = (sectionContent.match(/^[\s]*[-*]\s+.{10,}/gm) ?? []).length;

  return Math.max(tableRows, bullets);
}

/**
 * Extract integration names from estimate markdown.
 */
function extractEstimateIntegrations(estimateMd: string): string[] {
  const integrations: string[] = [];
  const lines = estimateMd.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const lower = trimmed.toLowerCase();

    // Look for integration keywords or tier markers
    if (
      lower.includes("integration") ||
      lower.includes(" t1") ||
      lower.includes(" t2") ||
      lower.includes(" t3") ||
      lower.includes("tier 1") ||
      lower.includes("tier 2") ||
      lower.includes("tier 3")
    ) {
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      const taskName = cells[0];
      if (taskName && taskName.length > 3 && !taskName.toLowerCase().includes("task")) {
        integrations.push(taskName);
      }
    }
  }

  return integrations;
}

/**
 * Check if proposal mentions specific integrations.
 */
function checkIntegrationCoverage(proposalMd: string, integrationNames: string[]): number {
  if (integrationNames.length === 0) return 0;
  const proposalLower = proposalMd.toLowerCase();
  let found = 0;

  for (const name of integrationNames) {
    // Check if any significant word from the integration name appears in proposal
    const words = name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hasMatch = words.some((word) => proposalLower.includes(word));
    if (hasMatch) found++;
  }

  return found;
}

/**
 * Extract section headings from solution architecture document.
 */
function extractArchitectureDecisions(solutionMd: string): string[] {
  const headings: string[] = [];
  const lines = solutionMd.split("\n");

  for (const line of lines) {
    const match = line.match(/^#{2,3}\s+(.+)/);
    if (match) {
      headings.push(match[1].trim());
    }
  }

  return headings;
}

/**
 * Validate a technical proposal against estimate data and solution architecture.
 */
export async function validateProposal(
  proposalMd: string,
  engagementId: string
): Promise<ProposalValidationReport> {
  const items: ProposalValidationItem[] = [];

  // Load estimate assumptions count from DB
  let estimateAssumptionCount = 0;
  let estimateRiskCount = 0;
  let estimateMd = "";
  let solutionMd = "";

  try {
    const assumptions = await prisma.assumption.count({
      where: { engagementId, status: "ACTIVE" },
    });
    estimateAssumptionCount = assumptions;

    const risks = await prisma.riskRegisterEntry.count({
      where: { engagementId },
    });
    estimateRiskCount = risks;

    // Load estimate content for integration extraction
    const estimatePhases = await prisma.phase.findMany({
      where: {
        engagementId,
        phaseNumber: { in: ["1A", "3"] },
        status: "APPROVED",
      },
      include: {
        artefacts: {
          where: { artefactType: "ESTIMATE" },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    for (const phase of estimatePhases) {
      if (phase.artefacts[0]?.contentMd) {
        estimateMd = phase.artefacts[0].contentMd;
        break;
      }
    }

    // Load solution architecture
    const solutionArtefacts = await prisma.phaseArtefact.findMany({
      where: {
        phase: { engagementId, phaseNumber: "1A" },
        artefactType: "RESEARCH",
      },
      orderBy: { version: "desc" },
      take: 1,
    });
    if (solutionArtefacts[0]?.contentMd?.includes("Architecture")) {
      solutionMd = solutionArtefacts[0].contentMd;
    }
  } catch {
    // DB access failure — validate with what we have
  }

  // 1. Assumption coverage
  const proposalAssumptions = countProposalAssumptions(proposalMd);
  if (estimateAssumptionCount > 0) {
    const coverage = proposalAssumptions / estimateAssumptionCount;
    items.push({
      category: "ASSUMPTION_COVERAGE",
      status: coverage >= 0.8 ? "PASS" : coverage >= 0.5 ? "WARN" : "FAIL",
      message:
        coverage >= 0.8
          ? "Proposal covers most estimate assumptions"
          : `Proposal has ${proposalAssumptions} assumptions vs ${estimateAssumptionCount} in estimate`,
      expected: estimateAssumptionCount,
      found: proposalAssumptions,
    });
  } else {
    items.push({
      category: "ASSUMPTION_COVERAGE",
      status: proposalAssumptions > 0 ? "PASS" : "WARN",
      message: proposalAssumptions > 0
        ? `Proposal includes ${proposalAssumptions} assumptions`
        : "No assumptions section found in proposal",
      found: proposalAssumptions,
    });
  }

  // 2. Risk coverage
  const proposalRisks = countProposalRisks(proposalMd);
  if (estimateRiskCount > 0) {
    const coverage = proposalRisks / estimateRiskCount;
    items.push({
      category: "RISK_COVERAGE",
      status: coverage >= 0.8 ? "PASS" : coverage >= 0.5 ? "WARN" : "FAIL",
      message:
        coverage >= 0.8
          ? "Proposal risk section covers estimate risks"
          : `Proposal has ${proposalRisks} risk items vs ${estimateRiskCount} in estimate`,
      expected: estimateRiskCount,
      found: proposalRisks,
    });
  } else {
    items.push({
      category: "RISK_COVERAGE",
      status: proposalRisks > 0 ? "PASS" : "WARN",
      message: proposalRisks > 0
        ? `Proposal includes ${proposalRisks} risk items`
        : "No risk summary section found in proposal",
      found: proposalRisks,
    });
  }

  // 3. Integration coverage
  const integrations = extractEstimateIntegrations(estimateMd);
  if (integrations.length > 0) {
    const found = checkIntegrationCoverage(proposalMd, integrations);
    const coverage = found / integrations.length;
    items.push({
      category: "INTEGRATION_COVERAGE",
      status: coverage >= 0.8 ? "PASS" : coverage >= 0.5 ? "WARN" : "FAIL",
      message:
        coverage >= 0.8
          ? "Proposal references most estimated integrations"
          : `Proposal mentions ${found} of ${integrations.length} estimated integrations`,
      expected: integrations.length,
      found,
    });
  } else {
    items.push({
      category: "INTEGRATION_COVERAGE",
      status: "PASS",
      message: "No integrations in estimate to check against",
    });
  }

  // 4. Architecture reference
  if (solutionMd) {
    const decisions = extractArchitectureDecisions(solutionMd);
    const proposalLower = proposalMd.toLowerCase();
    let referenced = 0;
    for (const heading of decisions) {
      const words = heading.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      if (words.some((w) => proposalLower.includes(w))) referenced++;
    }
    const coverage = decisions.length > 0 ? referenced / decisions.length : 1;
    items.push({
      category: "ARCHITECTURE_REFERENCE",
      status: coverage >= 0.7 ? "PASS" : coverage >= 0.4 ? "WARN" : "FAIL",
      message:
        coverage >= 0.7
          ? "Proposal references solution architecture decisions"
          : `Proposal covers ${referenced} of ${decisions.length} architecture sections`,
      expected: decisions.length,
      found: referenced,
    });
  } else {
    items.push({
      category: "ARCHITECTURE_REFERENCE",
      status: "PASS",
      message: "No solution architecture document to check against",
    });
  }

  // Run DB-backed structured validators (integration tier + proposal→TOR).
  const structured = await runStructuredProposalValidators(
    engagementId,
    proposalMd
  );

  // Overall status incorporates structured validator outcomes.
  const structuredFail =
    structured?.integrationTier.status === "FAIL" ||
    structured?.proposalObjective.status === "FAIL";
  const structuredWarn =
    structured?.integrationTier.status === "WARN" ||
    structured?.proposalObjective.status === "WARN";

  const hasFail = items.some((i) => i.status === "FAIL") || structuredFail;
  const hasWarn = items.some((i) => i.status === "WARN") || structuredWarn;
  const overallStatus: "PASS" | "WARN" | "FAIL" = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { items, overallStatus, structured };
}

/**
 * Runs the DB-backed validators for the proposal phase and writes a
 * ValidationReport row for phase 5.  Failure is non-fatal to the parent
 * report — warnings are logged but the base report still returns.
 */
async function runStructuredProposalValidators(
  engagementId: string,
  proposalMd: string
): Promise<StructuredProposalSummary | undefined> {
  try {
    const [integrationTier, proposalObjective] = await Promise.all([
      runIntegrationTierValidation(engagementId, proposalMd),
      runProposalObjectiveValidation(engagementId, proposalMd),
    ]);

    const missingRequirementCount =
      (proposalObjective.details.missingRequirementCount as number | undefined) ?? 0;
    const unmappedObjectiveCount =
      (proposalObjective.details.unmappedObjectiveCount as number | undefined) ?? 0;
    const tierMissing =
      (integrationTier.details.missingTierCount as number | undefined) ?? 0;
    const proposalTierMiss =
      (integrationTier.details.proposalMissCount as number | undefined) ?? 0;

    const rawScore =
      1.0 -
      missingRequirementCount * 0.05 -
      unmappedObjectiveCount * 0.02 -
      tierMissing * 0.05 -
      proposalTierMiss * 0.02;
    const accuracyScore = Math.max(0, Math.min(1, rawScore));

    const statuses = [integrationTier.status, proposalObjective.status];
    const overallStatus = statuses.includes("FAIL")
      ? "FAIL"
      : statuses.includes("WARN")
        ? "WARN"
        : "PASS";

    let validationReportId: string | undefined;
    try {
      const row = await prisma.validationReport.create({
        data: {
          engagementId,
          phaseNumber: "5",
          overallStatus,
          accuracyScore,
          gapCount: missingRequirementCount,
          orphanCount: unmappedObjectiveCount,
          confFormulaViolations: 0,
          noBenchmarkCount: 0,
          details: JSON.parse(
            JSON.stringify({ integrationTier, proposalObjective })
          ),
        },
      });
      validationReportId = row.id;
    } catch (err) {
      console.warn(
        `[validate-proposal] ValidationReport insert failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return {
      integrationTier,
      proposalObjective,
      accuracyScore,
      validationReportId,
    };
  } catch (err) {
    console.warn(
      `[validate-proposal] structured validators failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return undefined;
  }
}
