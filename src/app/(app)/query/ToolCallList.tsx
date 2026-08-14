export function ToolCallList({ toolCalls }: { toolCalls: unknown }) {
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
