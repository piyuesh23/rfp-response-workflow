/**
 * Post-generation proposal validation.
 * Checks that a technical proposal carries forward assumptions, risks,
 * integrations, and architecture decisions from the estimate phase.
 * Pure TypeScript — no AI calls.
 */

import { prisma } from "@/lib/db";

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

  // Overall status
  const hasFail = items.some((i) => i.status === "FAIL");
  const hasWarn = items.some((i) => i.status === "WARN");
  const overallStatus: "PASS" | "WARN" | "FAIL" = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { items, overallStatus };
}
