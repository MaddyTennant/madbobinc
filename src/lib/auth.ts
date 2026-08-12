import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

const SESSION_COOKIE = "madbob_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  role: Role;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. Generate with `openssl rand -hex 32`.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string" &&
      typeof payload.workspaceId === "string" &&
      typeof payload.role === "string"
    ) {
      return payload as unknown as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Sets the session cookie. Only callable from a Server Action or Route Handler. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Reads and verifies the current session. Safe to call from Server Components. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** For use in Server Components/pages: redirects to /login if unauthenticated. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Like requireSession(), but also verifies the session's user still exists in
 * the database. A valid-looking session cookie can outlive its user (e.g. the
 * database was reset, or the account was deleted) — without this check, code
 * that trusts session.userId (like creating a workspace) fails with a raw
 * foreign-key error instead of sending the visitor back to log in.
 *
 * Deliberately does not clear the cookie here: Next.js only allows mutating
 * cookies from a Server Action or Route Handler, and this helper is also
 * called from plain page Server Components. The stale cookie is harmless —
 * every check here will just keep redirecting to /login until the next
 * successful login overwrites it.
 */
export async function requireValidSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session!.userId } });
  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Your session has expired. Please log in again.")}`);
  }
  return session!;
}

export interface InvitePayload {
  purpose: "invite";
  email: string;
  workspaceId: string;
  role: Role;
}

const INVITE_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export async function signInviteToken(payload: Omit<InvitePayload, "purpose">): Promise<string> {
  return new SignJWT({ ...payload, purpose: "invite" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${INVITE_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyInviteToken(token: string): Promise<InvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.purpose === "invite" &&
      typeof payload.email === "string" &&
      typeof payload.workspaceId === "string" &&
      typeof payload.role === "string"
    ) {
      return payload as unknown as InvitePayload;
    }
    return null;
  } catch {
    return null;
  }
}
