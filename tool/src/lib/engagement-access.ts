import type { ShareAccessLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { AuthedSession } from "@/lib/auth-guard";

export type EffectiveAccess = {
  canRead: boolean;
  canEdit: boolean;
  source: "OWNER" | "GLOBAL" | "SHARE" | "NONE";
  shareLevel: ShareAccessLevel | null;
};

/**
 * Returns the effective access a session user has on a specific engagement.
 *
 * Priority order:
 *  1. ADMIN / MANAGER → full access globally
 *  2. Engagement owner (createdById) → full access
 *  3. Active EngagementShare for this user → share-level access
 *  4. VIEWER → global read-only (preserved for current behaviour)
 *  5. All others → no access
 */
export async function getEngagementAccess(
  session: AuthedSession,
  engagementId: string,
): Promise<EffectiveAccess> {
  const { id: userId, role } = session.user;

  if (role === "ADMIN" || role === "MANAGER") {
    return { canRead: true, canEdit: true, source: "GLOBAL", shareLevel: null };
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { createdById: true },
  });

  if (!engagement) {
    return { canRead: false, canEdit: false, source: "NONE", shareLevel: null };
  }

  if (engagement.createdById === userId) {
    return { canRead: true, canEdit: true, source: "OWNER", shareLevel: null };
  }

  const share = await prisma.engagementShare.findFirst({
    where: { engagementId, userId, revokedAt: null },
    select: { accessLevel: true },
  });

  if (share) {
    const canEdit = share.accessLevel === "FULL_ACCESS";
    return {
      canRead: true,
      canEdit,
      source: "SHARE",
      shareLevel: share.accessLevel,
    };
  }

  if (role === "VIEWER") {
    return {
      canRead: true,
      canEdit: false,
      source: "GLOBAL",
      shareLevel: null,
    };
  }

  return { canRead: false, canEdit: false, source: "NONE", shareLevel: null };
}

/**
 * Throws a FORBIDDEN error if the session user cannot edit the engagement.
 * Use inside API route handlers after requireAuth().
 */
export async function requireEngagementEdit(
  session: AuthedSession,
  engagementId: string,
): Promise<EffectiveAccess> {
  const access = await getEngagementAccess(session, engagementId);
  if (!access.canEdit) {
    const err = new Error("Forbidden: insufficient engagement access");
    (err as NodeJS.ErrnoException).code = "FORBIDDEN";
    throw err;
  }
  return access;
}
