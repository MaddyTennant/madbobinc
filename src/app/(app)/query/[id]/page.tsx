import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { askQuestionAction, rerunQueryAction, togglePinAction } from "../actions";
import { ToolCallList } from "../ToolCallList";
import { PinIcon } from "@/components/icons";
import { AskForm } from "../AskForm";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCurrentMembership();

  const conversation = await db.conversation.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!conversation) notFound();

  const turns = await db.queryHistory.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  const pinned = turns.filter((t) => t.pinned);

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-10">
      <div className="flex-1 space-y-10 pb-6">
        {pinned.length > 0 ? (
          <div className="flex flex-wrap gap-2 pb-2">
            {pinned.map((p) => (
              <span key={p.id} className="badge inline-flex items-center gap-1 bg-brand-100 text-brand-800">
                <PinIcon className="h-3 w-3" /> {p.question}
              </span>
            ))}
          </div>
        ) : null}

        {turns.map((entry) => (
          <div key={entry.id} className="space-y-4">
            <div className="flex justify-end">
              <p className="max-w-[75%] rounded-[20px] bg-paper-200 px-4 py-2.5 text-sm text-stone-800">
                {entry.question}
              </p>
            </div>
            <div>
              <p className="whitespace-pre-wrap text-sm leading-[21px] text-stone-700">{entry.answer}</p>
              <ToolCallList toolCalls={entry.toolCalls} />
              <div className="mt-3 flex gap-4">
                <form action={togglePinAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="text-xs font-medium text-stone-400 hover:text-brand-600" type="submit">
                    {entry.pinned ? "Unpin" : "Pin"}
                  </button>
                </form>
                <form action={rerunQueryAction}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="text-xs font-medium text-stone-400 hover:text-stone-600" type="submit">
                    Re-run
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-paper via-paper to-transparent px-6 pb-8 pt-10">
        <AskForm action={askQuestionAction} conversationId={conversation.id} placeholder="Ask a follow-up…" />
      </div>
    </div>
  );
}
