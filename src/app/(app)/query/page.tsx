import { db } from "@/lib/db";
import { requireCurrentMembership } from "@/lib/tenant";
import { isLlmConfigured } from "@/lib/llm/client";
import { SparkleIcon } from "@/components/icons";
import { askQuestionAction } from "./actions";
import { AskForm } from "./AskForm";

const HOSPITALITY_SAMPLE_QUESTIONS = [
  "How much did we spend on seafood last quarter?",
  "Which supplier raised prices the most this month?",
  "Why was labor cost up this month?",
];

const TECH_SAMPLE_QUESTIONS = [
  "How much did we spend on Azure compute last quarter?",
  "Which vendor's bill grew the most this month?",
  "Why was our Datadog spend up this month?",
];

export default async function QueryPage() {
  const session = await requireCurrentMembership();
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: session.workspaceId } });
  const sampleQuestions = workspace.vertical === "TECH" ? TECH_SAMPLE_QUESTIONS : HOSPITALITY_SAMPLE_QUESTIONS;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="flex items-center gap-3 text-4xl leading-none tracking-[-0.02em] font-normal text-stone-700">
          <SparkleIcon className="h-8 w-8 text-brand-600" />
          Ask {workspace.name} anything
        </h1>
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
          {sampleQuestions.map((q) => (
            <form key={q} action={askQuestionAction}>
              <input type="hidden" name="question" value={q} />
              <button
                type="submit"
                className="rounded-full border border-stone-200 bg-surface px-3 py-1.5 text-xs text-stone-600 hover:border-brand-400 hover:text-brand-800"
              >
                {q}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 bg-gradient-to-t from-paper via-paper to-transparent px-6 pb-8 pt-10">
        <AskForm action={askQuestionAction} placeholder="Ask about your spend…" />
      </div>
    </div>
  );
}
