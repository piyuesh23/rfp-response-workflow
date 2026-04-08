import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, guardErrorStatus } from "@/lib/auth-guard";
import type { TechStack } from "@/generated/prisma/enums";

const VALID_TECH_STACKS: TechStack[] = ["DRUPAL", "DRUPAL_NEXTJS", "WORDPRESS", "WORDPRESS_NEXTJS", "NEXTJS", "REACT"];

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const techStack = searchParams.get("techStack") ?? undefined;

  const benchmarks = await prisma.benchmark.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(techStack ? { techStack: techStack as TechStack } : {}),
    },
    orderBy: [{ category: "asc" }, { taskType: "asc" }],
  });

  return NextResponse.json(benchmarks);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const body = await request.json();
  const { techStack, category, taskType, lowHours, highHours, tier, notes } = body as {
    techStack: TechStack;
    category: string;
    taskType: string;
    lowHours: number;
    highHours: number;
    tier?: string;
    notes?: string;
  };

  if (!techStack || !category || !taskType || lowHours == null || highHours == null) {
    return NextResponse.json(
      { error: "techStack, category, taskType, lowHours, and highHours are required" },
      { status: 400 }
    );
  }

  if (!VALID_TECH_STACKS.includes(techStack)) {
    return NextResponse.json(
      { error: `Invalid techStack. Must be one of: ${VALID_TECH_STACKS.join(", ")}` },
      { status: 400 }
    );
  }

  if (lowHours < 0 || highHours < 0 || lowHours > highHours) {
    return NextResponse.json(
      { error: "lowHours must be >= 0 and <= highHours" },
      { status: 400 }
    );
  }

  const benchmark = await prisma.benchmark.create({
    data: {
      techStack,
      category,
      taskType,
      lowHours,
      highHours,
      tier: tier ?? null,
      notes: notes ?? null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(benchmark, { status: 201 });
}
