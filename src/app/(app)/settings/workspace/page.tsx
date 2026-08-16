import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { can } from "@/lib/rbac";
import { techOnlyMode } from "@/lib/flags";
import { addSiteAction, setVerticalAction } from "./actions";

const VERTICAL_LABELS: Record<string, string> = {
  HOSPITALITY: "Hospitality",
  HEALTHCARE: "Healthcare",
  TECH: "Tech",
};

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireCurrentMembership();
  const { error } = await searchParams;
  const canManage = can(session.role, "workspace:manage");

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const sites = await db.site.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-normal tracking-tight text-stone-700">Workspace</h1>
        <p className="text-sm text-stone-500">Manage this workspace's vertical and sites.</p>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="card max-w-md">
        <h2 className="mb-1 font-medium text-stone-900">Vertical</h2>
        <p className="mb-3 text-sm text-stone-500">
          {VERTICAL_LABELS[workspace.vertical]} — determines which connectors show up on the Integrations page.
          Healthcare is still a placeholder and sees the same catalog as Hospitality.
          {techOnlyMode() ? " Locked to Tech for this demo." : ""}
        </p>
        {canManage && !techOnlyMode() ? (
          <form action={setVerticalAction} className="flex items-center gap-2">
            <select className="input" name="vertical" defaultValue={workspace.vertical}>
              <option value="HOSPITALITY">Hospitality</option>
              <option value="HEALTHCARE">Healthcare</option>
              <option value="TECH">Tech</option>
            </select>
            <button className="btn-secondary" type="submit">
              Save
            </button>
          </form>
        ) : null}
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium text-stone-900">Sites</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Location</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2">{s.name}</td>
                <td className="py-2 text-stone-500">{s.location}</td>
                <td className="py-2">
                  {s.isDefault ? (
                    <span className="badge bg-brand-100 text-brand-800">Default</span>
                  ) : (
                    <span className="text-xs text-stone-400">Placeholder — no connected data yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && workspace.vertical !== "TECH" ? (
        <div className="card max-w-md">
          <h2 className="mb-3 font-medium text-stone-900">Add another site</h2>
          <p className="mb-3 text-xs text-stone-500">
            New sites are placeholders for now — connectors, transactions, and chat answers aren't scoped per site
            yet, so an added site won't have any data of its own until that's built.
          </p>
          <form action={addSiteAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="site-name">
                Site name
              </label>
              <input className="input" id="site-name" name="name" required placeholder="Ruth's Uptown" />
            </div>
            <div>
              <label className="label" htmlFor="site-location">
                Location
              </label>
              <input className="input" id="site-location" name="location" required placeholder="Amsterdam, NL" />
            </div>
            <button className="btn-primary w-full" type="submit">
              Add site
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
