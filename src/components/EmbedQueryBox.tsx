"use client";

import { useState } from "react";

export function EmbedQueryBox({ token }: { token: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch(`/api/embed/${token}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await res.json();
      setAnswer(res.ok ? body.answer : (body.error ?? "Something went wrong."));
    } catch {
      setAnswer("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-3 font-medium text-stone-900">Ask about this restaurant's spend</h2>
      <form onSubmit={ask} className="flex gap-2">
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which category grew the most this month?"
        />
        <button className="btn-primary whitespace-nowrap" type="submit" disabled={busy}>
          {busy ? "Asking…" : "Ask"}
        </button>
      </form>
      {answer ? <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">{answer}</p> : null}
    </div>
  );
}
