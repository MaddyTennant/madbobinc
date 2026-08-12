import { db } from "@/lib/db";
import { verifyInviteToken } from "@/lib/auth";
import { acceptInviteAction } from "./actions";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <p className="text-sm text-stone-600">Missing invite token.</p>
      </div>
    );
  }

  const invite = await verifyInviteToken(token);
  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <p className="text-sm text-red-600">This invite link is invalid or has expired.</p>
      </div>
    );
  }

  const [workspace, existingUser] = await Promise.all([
    db.workspace.findUnique({ where: { id: invite.workspaceId } }),
    db.user.findUnique({ where: { email: invite.email } }),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-stone-900">Join {workspace?.name}</h1>
        <p className="mb-6 text-sm text-stone-500">
          You&apos;ve been invited as <span className="font-medium">{invite.role.replace("_", " ")}</span>.
        </p>

        <form action={acceptInviteAction} className="card space-y-4">
          <input type="hidden" name="token" value={token} />
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div>
            <label className="label">Email</label>
            <input className="input bg-stone-100" value={invite.email} disabled readOnly />
          </div>
          {!existingUser ? (
            <div>
              <label className="label" htmlFor="name">
                Your name
              </label>
              <input className="input" id="name" name="name" required />
            </div>
          ) : null}
          <div>
            <label className="label" htmlFor="password">
              {existingUser ? "Password" : "Choose a password"}
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              minLength={existingUser ? undefined : 8}
              autoComplete={existingUser ? "current-password" : "new-password"}
            />
          </div>
          <button className="btn-primary w-full" type="submit">
            {existingUser ? "Join workspace" : "Create account & join"}
          </button>
        </form>
      </div>
    </div>
  );
}
