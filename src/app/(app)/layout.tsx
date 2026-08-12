import Link from "next/link";
import { redirect } from "next/navigation";
import { requireValidSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../(auth)/actions";

const SECONDARY_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/integrations", label: "Integrations" },
  { href: "/insights", label: "Insights & Alerts" },
  { href: "/budgets", label: "Budgets & Approvals" },
  { href: "/vendors", label: "Vendors" },
  { href: "/reports", label: "Reports" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/api-keys", label: "API & Embed" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireValidSession();
  if (!session.workspaceId) redirect("/workspace/new");

  const workspace = await db.workspace.findUnique({ where: { id: session.workspaceId } });
  if (!workspace) redirect("/workspace/new");

  const recentQuestions = await db.queryHistory.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, question: true },
  });

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-72 flex-shrink-0 flex-col bg-paper-200/60 px-3 py-4">
        <Link href="/query" className="mb-6 flex items-center gap-2 px-2">
          <Logo />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">{workspace.name}</p>
            <p className="truncate text-xs text-stone-400">Spend AI</p>
          </div>
        </Link>

        <Link
          href="/query"
          className="mb-4 flex items-center gap-2 rounded-xl bg-brand-800 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-900"
        >
          <span aria-hidden>✦</span> Ask AI
        </Link>

        {recentQuestions.length > 0 ? (
          <div className="mb-4 min-h-0 flex-1 overflow-y-auto">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-stone-400">Recent</p>
            <div className="space-y-0.5">
              {recentQuestions.map((q) => (
                <Link
                  key={q.id}
                  href="/query"
                  className="block truncate rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:bg-white/70"
                  title={q.question}
                >
                  {q.question}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4 flex-1" />
        )}

        <div className="mb-2 border-t border-stone-300/60 pt-3">
          <nav className="space-y-0.5">
            {SECONDARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 hover:bg-white/70 hover:text-stone-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-stone-300/60 px-2 pt-3">
          <p className="truncate text-sm font-medium text-stone-700">{session.name}</p>
          <p className="truncate text-xs text-stone-400">{session.role.replace("_", " ")}</p>
          <form action={logoutAction}>
            <button className="mt-1 text-xs font-medium text-stone-400 hover:text-stone-600" type="submit">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-paper">{children}</main>
    </div>
  );
}
