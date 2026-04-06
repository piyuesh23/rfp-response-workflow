import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const benchmarks = await prisma.benchmark.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { taskType: "asc" }],
  });

  return NextResponse.json(benchmarks);
}
