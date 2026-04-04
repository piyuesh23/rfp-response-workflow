import type { UserRole } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

/**
 * Permission definitions per role.
 * VIEWER < MANAGER < ADMIN (additive).
 */
const PERMISSIONS = {
  READ_ENGAGEMENTS: ["VIEWER", "MANAGER", "ADMIN"] as UserRole[],
  READ_PHASES: ["VIEWER", "MANAGER", "ADMIN"] as UserRole[],
  READ_ARTEFACTS: ["VIEWER", "MANAGER", "ADMIN"] as UserRole[],
  READ_ESTIMATES: ["VIEWER", "MANAGER", "ADMIN"] as UserRole[],
  CREATE_ENGAGEMENT: ["MANAGER", "ADMIN"] as UserRole[],
  EDIT_ENGAGEMENT: ["MANAGER", "ADMIN"] as UserRole[],
  DELETE_ENGAGEMENT: ["MANAGER", "ADMIN"] as UserRole[],
  RUN_PHASE: ["MANAGER", "ADMIN"] as UserRole[],
  APPROVE_PHASE: ["MANAGER", "ADMIN"] as UserRole[],
  EDIT_ESTIMATE: ["MANAGER", "ADMIN"] as UserRole[],
  MANAGE_USERS: ["ADMIN"] as UserRole[],
} as const;

function hasPermission(
  role: UserRole,
  permission: keyof typeof PERMISSIONS
): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function canRunPhase(role: UserRole): boolean {
  return hasPermission(role, "RUN_PHASE");
}

export function canEditEstimate(role: UserRole): boolean {
  return hasPermission(role, "EDIT_ESTIMATE");
}

export function canApprovePhase(role: UserRole): boolean {
  return hasPermission(role, "APPROVE_PHASE");
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, "MANAGE_USERS");
}

export function canCreateEngagement(role: UserRole): boolean {
  return hasPermission(role, "CREATE_ENGAGEMENT");
}

/**
 * Throws if the session user's role is not in the allowed list.
 * Use inside API route handlers after confirming authentication.
 */
export function requireRole(
  session: Session,
  ...allowedRoles: UserRole[]
): void {
  const role = session.user?.role;
  if (!role || !allowedRoles.includes(role)) {
    const err = new Error("Forbidden: insufficient role");
    (err as NodeJS.ErrnoException).code = "FORBIDDEN";
    throw err;
  }
}
