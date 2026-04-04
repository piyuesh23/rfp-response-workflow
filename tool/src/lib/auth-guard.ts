import { auth } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

export type AuthedSession = Session & {
  user: Session["user"] & { id: string; role: UserRole };
};

/**
 * Returns the current session with the user's id and role populated.
 * Returns null if the user is not authenticated.
 */
export async function getAuthedSession(): Promise<AuthedSession | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return session as AuthedSession;
}

/**
 * Throws a 401 error object if the user is not authenticated.
 * Callers should catch and return NextResponse.json({ error }, { status }).
 */
export async function requireAuth(): Promise<AuthedSession> {
  const session = await getAuthedSession();
  if (!session) {
    const err = new Error("Unauthorized");
    (err as NodeJS.ErrnoException).code = "UNAUTHORIZED";
    throw err;
  }
  return session;
}

/**
 * Throws a 403 error object if the authenticated user's role is not in
 * the provided list of allowed roles.
 */
export async function requireRoles(
  ...roles: UserRole[]
): Promise<AuthedSession> {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    const err = new Error("Forbidden: insufficient role");
    (err as NodeJS.ErrnoException).code = "FORBIDDEN";
    throw err;
  }
  return session;
}

/**
 * Utility to translate guard errors into HTTP status codes.
 * Usage: catch (e) { const { status, message } = guardErrorStatus(e); }
 */
export function guardErrorStatus(err: unknown): {
  status: number;
  message: string;
} {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "UNAUTHORIZED") return { status: 401, message: err.message };
    if (code === "FORBIDDEN") return { status: 403, message: err.message };
  }
  return { status: 500, message: "Internal server error" };
}
