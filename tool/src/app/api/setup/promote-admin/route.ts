import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const setupKey = process.env.SETUP_SECRET;
  if (!setupKey) {
    return NextResponse.json(
      { error: "SETUP_SECRET not configured" },
      { status: 404 }
    );
  }

  const headerKey = request.headers.get("x-setup-key");
  if (headerKey !== setupKey) {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 403 });
  }

  const body = await request.json();
  const { email } = body as { email?: string };

  if (!email) {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: `User with email ${email} not found. Sign in first to create the account.` },
      { status: 404 }
    );
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({
    message: `${updated.name} (${updated.email}) promoted to ADMIN`,
    user: updated,
  });
}
