/**
 * Integration-tier validator — M3.c.
 *
 * Every TorRequirement with `domain = "integration"` must map to at least
 * one LineItem whose `integrationTier` is one of T1/T2/T3.  When a proposal
 * markdown is supplied, the tier must also be stated in the proposal text
 * near the integration name (within a 200-char window).
 *
 * Grading:
 *   FAIL — any integration requirement without a tiered line item
 *   WARN — proposal supplied but tier not found near integration mention
 *   PASS — all integrations tiered in estimate and (if applicable) proposal
 */

import { prisma } from "@/lib/db";
import type { ValidatorResult } from "./types";
import { emptyPass } from "./types";

const VALID_TIERS = new Set(["T1", "T2", "T3"]);

function tokensOf(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 3);
}

function findTierNearMention(
  proposalMd: string,
  integrationTitle: string
): string | null {
  const lower = proposalMd.toLowerCase();
  const tokens = tokensOf(integrationTitle);
  if (tokens.length === 0) return null;

  // Locate the first token occurrence, then scan ±200 chars for T1/T2/T3.
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx < 0) continue;
    const start = Math.max(0, idx - 200);
    const end = Math.min(proposalMd.length, idx + token.length + 200);
    const window = proposalMd.slice(start, end);
    const match = window.match(/\bT[123]\b/);
    if (match) return match[0];
  }
  return null;
}

function mentionedInProposal(
  proposalMd: string,
  integrationTitle: string
): boolean {
  const lower = proposalMd.toLowerCase();
  const tokens = tokensOf(integrationTitle);
  return tokens.some((t) => lower.includes(t));
}

export async function runIntegrationTierValidation(
  engagementId: string,
  proposalMd?: string
): Promise<ValidatorResult> {
  const integrations = await prisma.torRequirement.findMany({
    where: { engagementId, domain: "integration" },
    include: {
      lineItems: {
        select: {
          id: true,
          task: true,
          integrationTier: true,
          description: true,
        },
      },
    },
  });

  if (integrations.length === 0) {
    return emptyPass("no TorRequirement rows with domain=integration");
  }

  const missingTier: Array<{
    requirementId: string;
    clauseRef: string;
    title: string;
  }> = [];
  const proposalMisses: Array<{
    requirementId: string;
    title: string;
    estimateTier: string;
  }> = [];

  for (const req of integrations) {
    const tieredItem = req.lineItems.find(
      (li) =>
        li.integrationTier !== null &&
        li.integrationTier !== undefined &&
        VALID_TIERS.has(li.integrationTier)
    );

    if (!tieredItem || !tieredItem.integrationTier) {
      missingTier.push({
        requirementId: req.id,
        clauseRef: req.clauseRef,
        title: req.title,
      });
      continue;
    }

    if (proposalMd && proposalMd.trim().length > 0) {
      if (!mentionedInProposal(proposalMd, req.title)) {
        proposalMisses.push({
          requirementId: req.id,
          title: req.title,
          estimateTier: tieredItem.integrationTier,
        });
        continue;
      }
      const tier = findTierNearMention(proposalMd, req.title);
      if (!tier) {
        proposalMisses.push({
          requirementId: req.id,
          title: req.title,
          estimateTier: tieredItem.integrationTier,
        });
      }
    }
  }

  const violations: ValidatorResult["violations"] = [];
  if (missingTier.length > 0) {
    violations.push({
      severity: "FAIL",
      message: `${missingTier.length} integration requirement(s) lack a T1/T2/T3 line item`,
      itemIds: missingTier.map((m) => m.requirementId),
    });
  }
  if (proposalMisses.length > 0) {
    violations.push({
      severity: "WARN",
      message: `${proposalMisses.length} integration(s) missing tier mention in proposal`,
      itemIds: proposalMisses.map((m) => m.requirementId),
    });
  }

  const status: ValidatorResult["status"] =
    missingTier.length > 0
      ? "FAIL"
      : proposalMisses.length > 0
        ? "WARN"
        : "PASS";

  return {
    status,
    details: {
      integrationCount: integrations.length,
      missingTierCount: missingTier.length,
      proposalMissCount: proposalMisses.length,
      missingTier,
      proposalMisses,
    },
    violations,
  };
}
