import { redirect } from "next/navigation";
import { requireValidSession } from "@/lib/auth";
import { db } from "@/lib/db";
import AppSidebar from "@/components/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireValidSession();
  if (!session.workspaceId) redirect("/workspace/new");

  const workspace = await db.workspace.findUnique({ where: { id: session.workspaceId } });
  if (!workspace) redirect("/workspace/new");

  const recentConversations = await db.conversation.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        workspaceName={workspace.name}
        vertical={workspace.vertical}
        user={{ name: session.name, role: session.role.replace("_", " ") }}
        history={recentConversations.map((c) => ({
          id: c.id,
          title: c.title ?? "Untitled",
          updatedAt: c.updatedAt.toISOString(),
          href: `/query/${c.id}`,
        }))}
      />
      <main className="flex-1 overflow-y-auto bg-paper">{children}</main>
    </div>
  );
}
