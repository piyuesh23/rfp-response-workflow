/**
 * Proposal to TOR objective validator — M4.c.
 *
 * Parses Section 2 (Understanding / Objectives) of a technical proposal and
 * maps each extracted objective to a TorRequirement via:
 *   (a) exact clauseRef match, or
 *   (b) token-overlap >= 0.6 against the requirement title + description.
 *
 * Reports:
 *   - unmappedObjectives: present in proposal but no TOR match
 *   - missingRequirements: TOR rows with no linked objective in the proposal
 *
 * Grading:
 *   FAIL — any missingRequirements > 0 (proposal omits a TOR requirement)
 *   WARN — unmappedObjectives > 0 (proposal invented scope)
 *   PASS — both zero
 *
 * NOTE: Section 2 detection relies on "## 2" / "## Understanding" / similar
 * heading conventions.  Regenerating old proposals that use different
 * heading styles may need template realignment.
 */

import { prisma } from "@/lib/db";
import type { ValidatorResult } from "./types";
import { emptyPass } from "./types";

const SECTION_2_RX =
  /^##\s+(?:2[\s.)]|Understanding(?:\s+(?:of\s+)?(?:the\s+)?(?:Brief|Objectives?|Scope|Project|Ask))?)/im;

const NEXT_SECTION_RX = /^##\s+(?!#)/m;

const CLAUSE_TOKEN_RX = /\b(?:Section\s*|Clause\s*)?(\d+(?:\.\d+)*)\b/g;

function extractSection2(md: string): string | null {
  const startMatch = md.match(SECTION_2_RX);
  if (!startMatch) return null;
  const startIdx = md.indexOf(startMatch[0]) + startMatch[0].length;
  const remainder = md.slice(startIdx);
  const nextMatch = remainder.match(NEXT_SECTION_RX);
  const body = nextMatch
    ? remainder.slice(0, remainder.indexOf(nextMatch[0]))
    : remainder;
  return body.trim();
}

function extractObjectives(sectionBody: string): string[] {
  const lines = sectionBody.split("\n");
  const objectives: string[] = [];
  let currentParagraph = "";

  for (const raw of lines) {
    const line = raw.trim();

    const bulletMatch = line.match(/^(?:[-*]|\d+\.)\s+(.{10,})$/);
    if (bulletMatch) {
      if (currentParagraph) {
        objectives.push(currentParagraph.trim());
        currentParagraph = "";
      }
      objectives.push(bulletMatch[1].trim());
      continue;
    }

    const subheading = line.match(/^###\s+(.{5,})$/);
    if (subheading) {
      if (currentParagraph) {
        objectives.push(currentParagraph.trim());
        currentParagraph = "";
      }
      objectives.push(subheading[1].trim());
      continue;
    }

    if (line.length === 0) {
      if (currentParagraph.trim().length > 20) {
        objectives.push(currentParagraph.trim());
      }
      currentParagraph = "";
      continue;
    }

    currentParagraph += (currentParagraph ? " " : "") + line;
  }
  if (currentParagraph.trim().length > 20) {
    objectives.push(currentParagraph.trim());
  }
  return objectives;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 3)
  );
}

function tokenOverlap(a: string, b: string): number {
  const at = tokenize(a);
  const bt = tokenize(b);
  if (at.size === 0 || bt.size === 0) return 0;
  let hit = 0;
  for (const t of at) if (bt.has(t)) hit += 1;
  return hit / Math.min(at.size, bt.size);
}

function extractClauseRefs(text: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  CLAUSE_TOKEN_RX.lastIndex = 0;
  while ((m = CLAUSE_TOKEN_RX.exec(text)) !== null) refs.push(m[1]);
  return refs;
}

export async function runProposalObjectiveValidation(
  engagementId: string,
  proposalMd: string
): Promise<ValidatorResult> {
  if (!proposalMd || proposalMd.trim().length === 0) {
    return emptyPass("no proposal content provided");
  }

  const requirements = await prisma.torRequirement.findMany({
    where: { engagementId },
    select: { id: true, clauseRef: true, title: true, description: true },
  });

  if (requirements.length === 0) {
    return emptyPass("no TorRequirement rows for this engagement");
  }

  const section2 = extractSection2(proposalMd);
  if (!section2) {
    return {
      status: "FAIL",
      details: {
        note: "Section 2 (Understanding/Objectives) not found in proposal",
        requirementCount: requirements.length,
      },
      violations: [
        {
          severity: "FAIL",
          message:
            "Proposal has no Section 2 (Understanding/Objectives) — cannot verify TOR coverage",
        },
      ],
    };
  }

  const objectives = extractObjectives(section2);
  const reqMatchedSet = new Set<string>();
  const unmappedObjectives: string[] = [];

  for (const objective of objectives) {
    const refs = extractClauseRefs(objective);
    let matched = false;

    for (const ref of refs) {
      const match = requirements.find((r) => r.clauseRef.includes(ref));
      if (match) {
        reqMatchedSet.add(match.id);
        matched = true;
      }
    }

    if (!matched) {
      let best: { id: string; score: number } | null = null;
      for (const req of requirements) {
        const scoreTitle = tokenOverlap(objective, req.title);
        const scoreDesc = tokenOverlap(objective, req.description);
        const score = Math.max(scoreTitle, scoreDesc);
        if (score >= 0.6 && (best === null || score > best.score)) {
          best = { id: req.id, score };
        }
      }
      if (best) {
        reqMatchedSet.add(best.id);
        matched = true;
      }
    }

    if (!matched) unmappedObjectives.push(objective.slice(0, 200));
  }

  const missingRequirements = requirements
    .filter((r) => !reqMatchedSet.has(r.id))
    .map((r) => ({ id: r.id, clauseRef: r.clauseRef, title: r.title }));

  const violations: ValidatorResult["violations"] = [];
  if (missingRequirements.length > 0) {
    violations.push({
      severity: "FAIL",
      message: `${missingRequirements.length} TOR requirement(s) not referenced in proposal Section 2`,
      itemIds: missingRequirements.map((m) => m.id),
    });
  }
  if (unmappedObjectives.length > 0) {
    violations.push({
      severity: "WARN",
      message: `${unmappedObjectives.length} proposal objective(s) do not map to any TOR requirement`,
    });
  }

  const status: ValidatorResult["status"] =
    missingRequirements.length > 0
      ? "FAIL"
      : unmappedObjectives.length > 0
        ? "WARN"
        : "PASS";

  return {
    status,
    details: {
      objectivesParsed: objectives.length,
      requirementsLinked: reqMatchedSet.size,
      unmappedObjectiveCount: unmappedObjectives.length,
      missingRequirementCount: missingRequirements.length,
      unmappedObjectives: unmappedObjectives.slice(0, 20),
      missingRequirements: missingRequirements.slice(0, 25),
    },
    violations,
  };
}
