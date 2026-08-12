import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { isLlmConfigured } from "@/lib/llm/client";
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
      <summary className="cursor-pointer text-xs font-medium text-slate-400">
        {toolCalls.length} source lookup(s)
      </summary>
      <ul className="mt-1 space-y-1 text-xs text-slate-500">
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

  const [history, pinned] = await Promise.all([
    db.queryHistory.findMany({ where: { workspaceId: session.workspaceId, pinned: false }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.queryHistory.findMany({ where: { workspaceId: session.workspaceId, pinned: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ask AI</h1>
        <p className="text-sm text-slate-500">
          Ask a plain-English question about your spend. The AI can only see your workspace's own data.
        </p>
        {!isLlmConfigured() ? (
          <p className="mt-1 text-xs text-amber-600">
            ANTHROPIC_API_KEY is not set — questions get a generic data summary instead of a real
            natural-language answer.
          </p>
        ) : null}
      </div>

      <form action={askQuestionAction} className="card space-y-3">
        <textarea
          className="input min-h-20"
          name="question"
          placeholder="e.g. Which supplier raised prices the most this month?"
          required
        />
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <span key={q} className="badge bg-slate-100 text-slate-500">
              {q}
            </span>
          ))}
        </div>
        <button className="btn-primary" type="submit">
          Ask
        </button>
      </form>

      {pinned.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-700">Pinned</h2>
          <div className="space-y-3">
            {pinned.map((q) => (
              <QueryEntry key={q.id} entry={q} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No questions asked yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((q) => (
              <QueryEntry key={q.id} entry={q} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QueryEntry({ entry }: { entry: { id: string; question: string; answer: string; toolCalls: unknown; pinned: boolean } }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-slate-900">{entry.question}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{entry.answer}</p>
      <ToolCallList toolCalls={entry.toolCalls} />
      <div className="mt-3 flex gap-3">
        <form action={togglePinAction}>
          <input type="hidden" name="id" value={entry.id} />
          <button className="text-xs font-medium text-brand-600 hover:underline" type="submit">
            {entry.pinned ? "Unpin" : "Pin"}
          </button>
        </form>
        <form action={rerunQueryAction}>
          <input type="hidden" name="id" value={entry.id} />
          <button className="text-xs font-medium text-slate-500 hover:underline" type="submit">
            Re-run
          </button>
        </form>
      </div>
    </div>
  );
}
