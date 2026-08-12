import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/integrations", label: "Integrations" },
  { href: "/insights", label: "Insights & Alerts" },
  { href: "/query", label: "Ask AI" },
  { href: "/budgets", label: "Budgets & Approvals" },
  { href: "/vendors", label: "Vendors" },
  { href: "/reports", label: "Reports" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/api-keys", label: "API & Embed" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.workspaceId) redirect("/workspace/new");

  const workspace = await db.workspace.findUnique({ where: { id: session.workspaceId } });
  if (!workspace) redirect("/workspace/new");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Workspace</p>
          <p className="truncate font-semibold text-slate-900">{workspace.name}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-slate-700">{session.name}</p>
          <p className="truncate text-xs text-slate-400">{session.role.replace("_", " ")}</p>
          <form action={logoutAction}>
            <button className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-600" type="submit">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
