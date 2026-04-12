import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, guardErrorStatus } from "@/lib/auth-guard";
import type { PromptCategory } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch (e) {
    const { status, message } = guardErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;

  const configs = await prisma.promptConfig.findMany({
    where: {
      ...(category ? { category: category as PromptCategory } : {}),
    },
    orderBy: [{ category: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      category: true,
      content: true,
      isDefault: true,
      updatedBy: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const result = configs.map((c) => ({
    ...c,
    content: c.content.length > 200 ? c.content.slice(0, 200) + "..." : c.content,
  }));

  return NextResponse.json(result);
}
