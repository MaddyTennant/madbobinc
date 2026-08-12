import "server-only";
import { db } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth";
import { can, ForbiddenError, type Action } from "@/lib/rbac";

export class UnauthorizedError extends Error {
  constructor() {
    super("No active session");
    this.name = "UnauthorizedError";
  }
}

/**
 * Re-reads the membership from the database rather than trusting the JWT's
 * embedded role, so a role change or removal takes effect immediately for
 * privileged (mutating) operations instead of only after the session expires.
 */
export async function requireCurrentMembership(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: session.userId, workspaceId: session.workspaceId } },
  });
  if (!membership) throw new UnauthorizedError();

  return { ...session, role: membership.role };
}

export async function requireAction(action: Action): Promise<SessionPayload> {
  const session = await requireCurrentMembership();
  if (!can(session.role, action)) throw new ForbiddenError(action);
  return session;
}

/** Scopes a where-clause to the caller's workspace. Use on every tenant-data query. */
export function scoped<T extends Record<string, unknown>>(workspaceId: string, where: T = {} as T) {
  return { ...where, workspaceId };
}
