import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { isLlmConfigured } from "@/lib/llm/client";
import { Logo } from "@/components/Logo";
import { askQuestionAction, rerunQueryAction, togglePinAction } from "./actions";

const SAMPLE_QUESTIONS = [
  "How much did we spend on seafood last quarter?",
  "Which supplier raised prices the most this month?",
  "Why was labor cost up this month?",
];

function ToolCallList({ toolCalls }: { toolCalls: unknown }) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-stone-400">
        {toolCalls.length} source lookup(s)
      </summary>
      <ul className="mt-1 space-y-1 text-xs text-stone-500">
        {(toolCalls as { tool: string; resultSummary: string }[]).map((tc, i) => (
          <li key={i} className="font-mono">
            {tc.tool}: {tc.resultSummary}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function QueryPage() {
  const session = await requireCurrentMembership();
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });

  const [recent, pinned] = await Promise.all([
    db.queryHistory.findMany({ where: { workspaceId: session.workspaceId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.queryHistory.findMany({ where: { workspaceId: session.workspaceId, pinned: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const thread = [...recent].reverse();

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-10">
      {thread.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-2xl font-semibold text-stone-900">Ask {workspace.name} anything</h1>
          <p className="mt-1 max-w-md text-sm text-stone-500">
            Plain-English questions about vendors, categories, price trends, and budgets — answered from your
            connected spend data.
          </p>
          {!isLlmConfigured() ? (
            <p className="mt-2 text-xs text-amber-600">
              ANTHROPIC_API_KEY is not set — you&apos;ll get a generic data summary instead of a real answer.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SAMPLE_QUESTIONS.map((q) => (
              <form key={q} action={askQuestionAction}>
                <input type="hidden" name="question" value={q} />
                <button
                  type="submit"
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:border-brand-400 hover:text-brand-800"
                >
                  {q}
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : (
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

          {thread.map((entry) => (
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
      )}

      <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-paper via-paper to-transparent px-6 pb-8 pt-10">
        <form action={askQuestionAction} className="flex items-end gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm">
          <textarea
            className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm placeholder:text-stone-400 focus:outline-none"
            name="question"
            rows={1}
            placeholder="Ask about your spend…"
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
