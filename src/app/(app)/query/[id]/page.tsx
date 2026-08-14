import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { askQuestionAction, rerunQueryAction, togglePinAction } from "../actions";
import { ToolCallList } from "../ToolCallList";

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
      <div className="flex-1 space-y-6 pb-6">
        {pinned.length > 0 ? (
          <div className="flex flex-wrap gap-2 pb-2">
            {pinned.map((p) => (
              <span key={p.id} className="badge bg-brand-100 text-brand-800">
                📌 {p.question}
              </span>
            ))}
          </div>
        ) : null}

        {turns.map((entry) => (
          <div key={entry.id} className="space-y-2">
            <div className="flex justify-end">
              <p className="max-w-[75%] rounded-2xl rounded-br-sm bg-brand-800 px-4 py-2 text-sm text-white">
                {entry.question}
              </p>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-4 py-3">
                <p className="whitespace-pre-wrap text-sm text-stone-700">{entry.answer}</p>
                <ToolCallList toolCalls={entry.toolCalls} />
                <div className="mt-2 flex gap-3">
                  <form action={togglePinAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button className="text-xs font-medium text-brand-600 hover:underline" type="submit">
                      {entry.pinned ? "Unpin" : "Pin"}
                    </button>
                  </form>
                  <form action={rerunQueryAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button className="text-xs font-medium text-stone-400 hover:underline" type="submit">
                      Re-run
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-paper via-paper to-transparent px-6 pb-8 pt-10">
        <form action={askQuestionAction} className="flex items-end gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <textarea
            className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm placeholder:text-stone-400 focus:outline-none"
            name="question"
            rows={1}
            placeholder="Ask a follow-up…"
            required
          />
          <button className="btn-primary flex-shrink-0" type="submit">
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
