import "server-only";
import { db } from "@/lib/db";
import { generateApiKey, hashApiKey } from "@/lib/crypto";
import { UnauthorizedError } from "@/lib/tenant";

export class ApiKeyScopeError extends Error {
  constructor(scope: string) {
    super(`This API key does not have the "${scope}" scope`);
    this.name = "ApiKeyScopeError";
  }
}

export interface CreatedApiKey {
  id: string;
  key: string; // raw key — returned exactly once, never persisted or logged
  prefix: string;
  scopes: string[];
}

export async function createApiKey(workspaceId: string, label: string, scopes: string[]): Promise<CreatedApiKey> {
  const { key, hash, prefix } = generateApiKey();
  const record = await db.apiKey.create({
    data: { workspaceId, label, keyHash: hash, keyPrefix: prefix, scopes },
  });
  return { id: record.id, key, prefix, scopes: record.scopes };
}

export interface ResolvedApiKey {
  id: string;
  workspaceId: string;
  scopes: string[];
}

/** Validates a raw API key (from a header or an embed URL) and returns its workspace + scopes, or null. */
export async function resolveApiKey(rawKey: string): Promise<ResolvedApiKey | null> {
  if (!rawKey) return null;
  const record = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(rawKey) } });
  if (!record || record.revokedAt) return null;

  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { id: record.id, workspaceId: record.workspaceId, scopes: record.scopes };
}

export function requireScope(key: ResolvedApiKey, scope: string): boolean {
  return key.scopes.includes(scope);
}

/** For public /api/v1/* routes: validates the X-API-Key header and required scope. */
export async function requireApiKey(req: Request, scope: string): Promise<ResolvedApiKey> {
  const rawKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = rawKey ? await resolveApiKey(rawKey) : null;
  if (!key) throw new UnauthorizedError();
  if (!requireScope(key, scope)) throw new ApiKeyScopeError(scope);
  return key;
}
