import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { createInviteAction } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  FINANCE_MANAGER: "Finance Manager",
  KITCHEN_MANAGER: "Kitchen Manager",
  VIEWER: "Viewer",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const session = await requireCurrentMembership();
  const { error, invite } = await searchParams;
  const canManage = can(session.role, "team:manage");

  const memberships = await db.membership.findMany({
    where: { workspaceId: session.workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  let inviteLink: string | null = null;
  if (invite) {
    const h = await headers();
    const host = h.get("host");
    const proto = host?.startsWith("localhost") ? "http" : "https";
    inviteLink = `${proto}://${host}/invite/accept?token=${invite}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Team</h1>
        <p className="text-sm text-stone-500">
          Everyone here can only see data inside this workspace. Roles control what they can act on.
        </p>
      </div>

      {inviteLink ? (
        <div className="card border-brand-200 bg-brand-50">
          <p className="text-sm font-medium text-brand-800">Invite link generated — share it with your teammate:</p>
          <p className="mt-2 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-stone-700">
            {inviteLink}
          </p>
          <p className="mt-2 text-xs text-brand-700">Valid for 14 days. It grants exactly the role selected below.</p>
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Members</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2">{m.user.name}</td>
                <td className="py-2 text-stone-500">{m.user.email}</td>
                <td className="py-2">{ROLE_LABELS[m.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div className="card max-w-md">
          <h2 className="mb-3 font-medium text-stone-900">Invite a teammate</h2>
          {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <form action={createInviteAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <div>
              <label className="label" htmlFor="role">
                Role
              </label>
              <select className="input" id="role" name="role" defaultValue="VIEWER">
                <option value="FINANCE_MANAGER">Finance Manager</option>
                <option value="KITCHEN_MANAGER">Kitchen Manager</option>
                <option value="VIEWER">Viewer</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <button className="btn-primary" type="submit">
              Generate invite link
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
