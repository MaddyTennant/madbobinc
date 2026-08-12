import type { Role } from "@prisma/client";

export type Action =
  | "integrations:manage"
  | "budgets:manage"
  | "approvals:decide"
  | "approvals:request"
  | "vendors:view"
  | "insights:manage"
  | "query:use"
  | "reports:view"
  | "team:manage"
  | "apikeys:manage"
  | "dashboard:view"
  | "transactions:manage";

const ROLE_ACTIONS: Record<Role, Action[]> = {
  OWNER: [
    "integrations:manage",
    "budgets:manage",
    "approvals:decide",
    "approvals:request",
    "vendors:view",
    "insights:manage",
    "query:use",
    "reports:view",
    "team:manage",
    "apikeys:manage",
    "dashboard:view",
    "transactions:manage",
  ],
  FINANCE_MANAGER: [
    "integrations:manage",
    "budgets:manage",
    "approvals:decide",
    "approvals:request",
    "vendors:view",
    "insights:manage",
    "query:use",
    "reports:view",
    "apikeys:manage",
    "dashboard:view",
    "transactions:manage",
  ],
  KITCHEN_MANAGER: ["approvals:request", "vendors:view", "query:use", "dashboard:view"],
  VIEWER: ["vendors:view", "query:use", "dashboard:view", "reports:view"],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_ACTIONS[role]?.includes(action) ?? false;
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Role does not have permission for action: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function requirePermission(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError(action);
}
