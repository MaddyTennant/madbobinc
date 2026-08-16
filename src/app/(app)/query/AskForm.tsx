"use client";

import { useState } from "react";
import { ArrowUpIcon } from "@/components/icons";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";

type AskFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  conversationId?: string;
  placeholder: string;
};

/** Answering a question is a real LLM round trip (tool calls + a model response),
 * typically 10+ seconds — without a pending state this reads as a frozen UI. */
export function AskForm({ action, conversationId, placeholder }: AskFormProps) {
  const [pending, setPending] = useState(false);

  return (
    <>
      {pending ? <ThinkingIndicator /> : null}
      <form
        action={action}
        onSubmit={() => setPending(true)}
        className="flex items-center gap-2 rounded-full border border-stone-200 bg-surface py-2 pl-5 pr-2 shadow-sm"
      >
        {conversationId ? <input type="hidden" name="conversationId" value={conversationId} /> : null}
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-sm placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
          name="question"
          placeholder={pending ? "Thinking…" : placeholder}
          required
          disabled={pending}
        />
        <button
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-colors hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          aria-label="Send"
          disabled={pending}
        >
          {pending ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <ArrowUpIcon className="h-4 w-4" />
          )}
        </button>
      </form>
    </>
  );
}
