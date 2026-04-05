import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { extractMetadataForPhase } from "@/lib/ai/metadata-extractor";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id },
    select: {
      createdById: true,
      phases: {
        select: {
          phaseNumber: true,
          status: true,
          artefacts: {
            select: { id: true, metadata: true, artefactType: true, contentMd: true },
            orderBy: { version: "desc" },
            take: 1, // latest version only
          },
        },
      },
      assumptions: {
        select: { status: true },
      },
      risks: {
        select: { conf: true, hoursAtRisk: true },
      },
    },
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  if (engagement.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Aggregate assumption counts
  const assumptions = engagement.assumptions;
  const assumptionCount = {
    total: assumptions.length,
    resolved: assumptions.filter(
      (a) => a.status === "CONFIRMED" || a.status === "REJECTED"
    ).length,
    open: assumptions.filter(
      (a) => a.status === "ACTIVE" || a.status === "SUPERSEDED"
    ).length,
  };

  // Aggregate risk counts
  const risks = engagement.risks;
  const riskCount = {
    total: risks.length,
    high: risks.filter((r) => r.conf <= 2).length,
    medium: risks.filter((r) => r.conf === 3 || r.conf === 4).length,
    low: risks.filter((r) => r.conf >= 5).length,
  };

  // Extract hours and clarity data from artefact metadata
  let totalHours = { low: 0, high: 0 };
  let hoursByTab = {
    backend: { low: 0, high: 0 },
    frontend: { low: 0, high: 0 },
    fixedCost: { low: 0, high: 0 },
    ai: { low: 0, high: 0 },
  };
  let requirementCount = 0;
  let clarityBreakdown = { clear: 0, needsClarification: 0, ambiguous: 0, missingDetail: 0 };
  let confidenceDistribution = { high56: 0, medium4: 0, low123: 0 };

  // Look for estimate metadata (from Phase 1A or Phase 3)
  for (const phase of engagement.phases) {
    for (const artefact of phase.artefacts) {
      if (!artefact.metadata || typeof artefact.metadata !== "object") continue;

      const meta = artefact.metadata as Record<string, unknown>;

      // Hours data
      if (meta.totalHours && typeof meta.totalHours === "object") {
        const th = meta.totalHours as { low?: number; high?: number };
        totalHours = {
          low: th.low ?? totalHours.low,
          high: th.high ?? totalHours.high,
        };
      }

      if (meta.hoursByTab && typeof meta.hoursByTab === "object") {
        const hbt = meta.hoursByTab as Record<string, { low?: number; high?: number }>;
        for (const tab of ["backend", "frontend", "fixedCost", "ai"] as const) {
          if (hbt[tab]) {
            hoursByTab[tab] = {
              low: hbt[tab].low ?? hoursByTab[tab].low,
              high: hbt[tab].high ?? hoursByTab[tab].high,
            };
          }
        }
      }

      // Requirement clarity data (from TOR assessment)
      if (typeof meta.requirementCount === "number") {
        requirementCount = meta.requirementCount;
      }

      if (meta.clarityBreakdown && typeof meta.clarityBreakdown === "object") {
        const cb = meta.clarityBreakdown as Record<string, number>;
        clarityBreakdown = {
          clear: cb.clear ?? clarityBreakdown.clear,
          needsClarification: cb.needsClarification ?? clarityBreakdown.needsClarification,
          ambiguous: cb.ambiguous ?? clarityBreakdown.ambiguous,
          missingDetail: cb.missingDetail ?? clarityBreakdown.missingDetail,
        };
      }

      // Confidence distribution
      if (meta.confidenceDistribution && typeof meta.confidenceDistribution === "object") {
        const cd = meta.confidenceDistribution as Record<string, number>;
        confidenceDistribution = {
          high56: cd.high56 ?? confidenceDistribution.high56,
          medium4: cd.medium4 ?? confidenceDistribution.medium4,
          low123: cd.low123 ?? confidenceDistribution.low123,
        };
      }
    }
  }

  // Fallback: if hours are all zeros but artefacts have content, re-extract metadata
  if (totalHours.low === 0 && totalHours.high === 0) {
    for (const phase of engagement.phases) {
      for (const artefact of phase.artefacts) {
        if (!artefact.contentMd) continue;
        const freshMeta = extractMetadataForPhase(phase.phaseNumber, artefact.contentMd);
        if (!freshMeta) continue;

        const fm = freshMeta as Record<string, unknown>;
        if (fm.totalHours && typeof fm.totalHours === "object") {
          const th = fm.totalHours as { low?: number; high?: number };
          if ((th.low ?? 0) > 0 || (th.high ?? 0) > 0) {
            totalHours = { low: th.low ?? 0, high: th.high ?? 0 };
          }
        }
        if (fm.hoursByTab && typeof fm.hoursByTab === "object") {
          const hbt = fm.hoursByTab as Record<string, { low?: number; high?: number }>;
          for (const tab of ["backend", "frontend", "fixedCost", "ai"] as const) {
            if (hbt[tab]) {
              hoursByTab[tab] = { low: hbt[tab].low ?? 0, high: hbt[tab].high ?? 0 };
            }
          }
        }
        if (fm.confidenceDistribution && typeof fm.confidenceDistribution === "object") {
          const cd = fm.confidenceDistribution as Record<string, number>;
          confidenceDistribution = {
            high56: cd.high56 ?? 0,
            medium4: cd.medium4 ?? 0,
            low123: cd.low123 ?? 0,
          };
        }
        if (typeof fm.requirementCount === "number") {
          requirementCount = fm.requirementCount;
        }
        if (fm.clarityBreakdown && typeof fm.clarityBreakdown === "object") {
          const cb = fm.clarityBreakdown as Record<string, number>;
          clarityBreakdown = {
            clear: cb.clear ?? 0,
            needsClarification: cb.needsClarification ?? 0,
            ambiguous: cb.ambiguous ?? 0,
            missingDetail: cb.missingDetail ?? 0,
          };
        }

        // Persist re-extracted metadata back to artefact for future requests
        prisma.phaseArtefact.update({
          where: { id: artefact.id },
          data: { metadata: freshMeta as unknown as Record<string, never> },
        }).catch(() => { /* non-fatal */ });
      }
    }
  }

  // If no structured metadata, compute from risk register
  if (confidenceDistribution.high56 === 0 && confidenceDistribution.medium4 === 0 && confidenceDistribution.low123 === 0 && risks.length > 0) {
    confidenceDistribution = {
      high56: risks.filter((r) => r.conf >= 5).length,
      medium4: risks.filter((r) => r.conf === 4).length,
      low123: risks.filter((r) => r.conf <= 3).length,
    };
  }

  // Compute total hours at risk
  const totalHoursAtRisk = risks.reduce((sum, r) => sum + r.hoursAtRisk, 0);

  return NextResponse.json({
    totalHours,
    hoursByTab,
    requirementCount,
    clarityBreakdown,
    confidenceDistribution,
    riskCount,
    assumptionCount,
    totalHoursAtRisk,
    phaseSummary: engagement.phases.map((p) => ({
      phaseNumber: p.phaseNumber,
      status: p.status,
      hasArtefacts: p.artefacts.length > 0,
    })),
  });
}
